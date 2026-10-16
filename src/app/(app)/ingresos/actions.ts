"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerStockMovement } from "@/lib/stock";

export type CreateStockEntryState = { error?: string };

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("La cantidad tiene que ser mayor a cero."),
  purchasePrice: z.number().min(0, "El precio de compra no puede ser negativo."),
  // Opcional: si se carga, también actualiza el precio de venta del
  // producto (specs/006, decisión del 2026-10-16) — igual criterio que el
  // de compra, solo que acá nunca es obligatorio.
  salePrice: z.number().min(0, "El precio de venta no puede ser negativo.").optional(),
});

const createSchema = z.object({
  supplierName: z.string().trim().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un ítem."),
});

export async function createStockEntry(
  items: { productId: string; quantity: number; purchasePrice: number; salePrice?: number }[],
  supplierName?: string,
): Promise<CreateStockEntryState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.INGRESO_MERCADERIA, "crear");
  requireSpecialPermission(currentUser, "cambiarPrecios");

  const parsed = createSchema.safeParse({ supplierName, items });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    return { error: "Uno de los productos elegidos no existe." };
  }
  const salePriceById = new Map(products.map((p) => [p.id, p.salePrice.toNumber()]));
  const purchasePriceById = new Map(products.map((p) => [p.id, p.purchasePrice.toNumber()]));

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.stockEntry.create({
      data: { supplierName: parsed.data.supplierName, userId: currentUser.id },
    });

    for (const item of parsed.data.items) {
      await tx.stockEntryItem.create({
        data: {
          stockEntryId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
        },
      });

      await registerStockMovement(tx, {
        productId: item.productId,
        type: "INGRESO",
        quantity: item.quantity,
        userId: currentUser.id,
      });

      // Se compara contra el precio vigente ANTES de este ingreso (no se
      // vuelve a leer de la base entre ítems): si el mismo producto aparece
      // dos veces en el mismo ingreso, el último ítem es el que termina
      // valiendo (spec.md, sección 7), y cada uno genera su propia fila de
      // historial si cambió respecto al anterior. El precio de venta es
      // opcional: si no se cargó en el ítem, se mantiene el vigente.
      const currentPurchasePrice = purchasePriceById.get(item.productId)!;
      const currentSalePrice = salePriceById.get(item.productId)!;
      const finalSalePrice = item.salePrice ?? currentSalePrice;
      const purchaseChanged = currentPurchasePrice !== item.purchasePrice;
      const saleChanged = item.salePrice !== undefined && item.salePrice !== currentSalePrice;

      if (purchaseChanged || saleChanged) {
        await tx.product.update({
          where: { id: item.productId },
          data: { purchasePrice: item.purchasePrice, salePrice: finalSalePrice },
        });
        await tx.productPriceHistory.create({
          data: {
            productId: item.productId,
            purchasePrice: item.purchasePrice,
            salePrice: finalSalePrice,
            changedByUserId: currentUser.id,
          },
        });
        purchasePriceById.set(item.productId, item.purchasePrice);
        salePriceById.set(item.productId, finalSalePrice);
      }
    }

    return created;
  });

  revalidatePath("/ingresos");
  revalidatePath("/inventario");
  redirect(`/ingresos/${entry.id}`);
}
