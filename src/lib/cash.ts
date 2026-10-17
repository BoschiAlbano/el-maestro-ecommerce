// Desde "enums" (no desde "client"): ver nota en stock.ts / permission-matrix.tsx.
import type { CashMovementType, PaymentMethod } from "@/generated/prisma/enums";

/** Subconjunto de `Prisma.TransactionClient` que usa esta función — permite
 * pasarle un mock en los tests (mismo criterio que `StockTx` en stock.ts). */
type CashTx = {
  cashMovement: {
    create: (args: {
      data: {
        shiftId: string;
        type: CashMovementType;
        amount: number;
        concept: string;
        paymentMethod: PaymentMethod;
        transferReference?: string;
        userId: string;
        saleId?: string;
        orderId?: string;
      };
    }) => Promise<{ id: string }>;
  };
};

type RegisterCashMovementInput = {
  shiftId: string;
  type: CashMovementType;
  /** Siempre positivo: el signo lo da `type` (specs/007, sección 1). */
  amount: number;
  concept: string;
  paymentMethod: PaymentMethod;
  /** Obligatorio cuando `paymentMethod` es TRANSFERENCIA — lo valida quien
   * llama, no esta función (mecánica pura, sin reglas de negocio). */
  transferReference?: string;
  userId: string;
  /** Solo cuando el origen es una venta (specs/008). */
  saleId?: string;
  /** Solo cuando el origen es la seña de un pedido (specs/009). */
  orderId?: string;
};

/**
 * Único camino para crear un `CashMovement` — mismo rol que
 * `registerStockMovement` (specs/005) para el stock. Recibe el cliente de
 * la transacción en curso (`tx`).
 *
 * Uso: `prisma.$transaction((tx) => registerCashMovement(tx, {...}))`
 */
export async function registerCashMovement(tx: CashTx, input: RegisterCashMovementInput) {
  return tx.cashMovement.create({
    data: {
      shiftId: input.shiftId,
      type: input.type,
      amount: input.amount,
      concept: input.concept,
      paymentMethod: input.paymentMethod,
      transferReference: input.transferReference,
      userId: input.userId,
      saleId: input.saleId,
      orderId: input.orderId,
    },
  });
}
