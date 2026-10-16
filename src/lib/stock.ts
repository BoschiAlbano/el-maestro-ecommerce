// Desde "enums" (no desde "client"): ese módulo no arrastra el runtime de
// Prisma — ver la misma nota en permission-matrix.tsx.
import type { StockMovementType } from "@/generated/prisma/enums";

/** Subconjunto de `Prisma.TransactionClient` que usa esta función — permite
 * pasarle un mock en los tests, sin depender de un cliente de Prisma real
 * (mismo criterio que `BarcodeLookup` en `barcode.ts`). */
type StockTx = {
  stockMovement: {
    create: (args: {
      data: {
        productId: string;
        type: StockMovementType;
        quantity: number;
        reason?: string;
        userId: string;
      };
    }) => Promise<{ id: string }>;
  };
  product: {
    update: (args: {
      where: { id: string };
      data: { currentStock: { increment: number } };
    }) => Promise<unknown>;
  };
};

type RegisterStockMovementInput = {
  productId: string;
  type: StockMovementType;
  /** Con signo: positivo suma, negativo resta. */
  quantity: number;
  /** Obligatorio para AJUSTE/MERMA; INGRESO/VENTA traen su propio contexto. */
  reason?: string;
  userId: string;
};

/**
 * Único camino para cambiar `Product.currentStock`. Recibe el cliente de la
 * transacción en curso (`tx`) — el movimiento y la actualización del stock
 * se guardan siempre juntos, nunca por separado (specs/005, sección 1).
 *
 * El stock puede quedar en negativo a propósito: no hay chequeo que lo
 * impida (specs/005, sección 5 y 7).
 *
 * Uso: `prisma.$transaction((tx) => registerStockMovement(tx, {...}))`
 */
export async function registerStockMovement(tx: StockTx, input: RegisterStockMovementInput) {
  const movement = await tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      userId: input.userId,
    },
  });

  await tx.product.update({
    where: { id: input.productId },
    data: { currentStock: { increment: input.quantity } },
  });

  return movement;
}
