"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerStockMovement } from "@/lib/stock";

export type ActionState = { error?: string };

const adjustSchema = z.object({
  kind: z.enum(["AJUSTE", "MERMA"]),
  // Solo se usa para AJUSTE: el formulario ni siquiera manda este campo
  // cuando el tipo es MERMA (siempre resta), así que llega `null`.
  direction: z.enum(["suma", "resta"]).optional(),
  quantity: z.coerce.number().int().positive("La cantidad tiene que ser mayor a cero."),
  reason: z.string().trim().min(1, "El motivo es obligatorio."),
});

export async function adjustStock(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.INVENTARIO, "editar");
  requireSpecialPermission(currentUser, "ajustarStock");

  const parsed = adjustSchema.safeParse({
    kind: formData.get("kind"),
    direction: formData.get("direction") ?? undefined,
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: "El producto no existe." };

  // Merma siempre resta; Ajuste puede sumar o restar (specs/005, sección 4).
  const signedQuantity =
    parsed.data.kind === "MERMA"
      ? -Math.abs(parsed.data.quantity)
      : parsed.data.direction === "resta"
        ? -parsed.data.quantity
        : parsed.data.quantity;

  await prisma.$transaction((tx) =>
    registerStockMovement(tx, {
      productId,
      type: parsed.data.kind,
      quantity: signedQuantity,
      reason: parsed.data.reason,
      userId: currentUser.id,
    }),
  );

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${productId}`);
  return {};
}
