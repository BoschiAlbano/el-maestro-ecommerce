"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerStockMovement } from "@/lib/stock";
import { computeCountAdjustments, type CountAdjustment } from "@/lib/stock-count";

export type PreviewCountState = { error?: string; adjustments?: CountAdjustment[] };
export type ConfirmCountState = { error?: string; applied?: number };

const FIELD_PREFIX = "qty_";

export async function previewCount(
  _prev: PreviewCountState,
  formData: FormData,
): Promise<PreviewCountState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.INVENTARIO, "editar");
  requireSpecialPermission(currentUser, "ajustarStock");

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, currentStock: true },
    orderBy: { name: "asc" },
  });

  const countedByProductId: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(FIELD_PREFIX) || typeof value !== "string" || value === "") continue;
    const productId = key.slice(FIELD_PREFIX.length);
    const counted = Number(value);
    if (!Number.isInteger(counted) || counted < 0) {
      return { error: "Las cantidades contadas tienen que ser números enteros, no negativos." };
    }
    countedByProductId[productId] = counted;
  }

  const adjustments = computeCountAdjustments(products, countedByProductId);
  return { adjustments };
}

export async function confirmCount(adjustments: CountAdjustment[]): Promise<ConfirmCountState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.INVENTARIO, "editar");
  requireSpecialPermission(currentUser, "ajustarStock");

  if (adjustments.length === 0) return { applied: 0 };

  // Se recalcula el delta contra el stock actual dentro de la transacción,
  // no se confía en el delta calculado en la previsualización: si el stock
  // cambió entre previsualizar y confirmar (otro ajuste, en el futuro una
  // venta), lo que importa es a qué cantidad contada se quiere llegar, no
  // el delta viejo.
  let applied = 0;
  await prisma.$transaction(async (tx) => {
    for (const adjustment of adjustments) {
      const product = await tx.product.findUnique({ where: { id: adjustment.productId } });
      if (!product) continue;
      const freshDelta = adjustment.counted - product.currentStock;
      if (freshDelta === 0) continue;

      await registerStockMovement(tx, {
        productId: adjustment.productId,
        type: "AJUSTE",
        quantity: freshDelta,
        reason: "Conteo físico",
        userId: currentUser.id,
      });
      applied++;
    }
  });

  revalidatePath("/inventario");
  return { applied };
}
