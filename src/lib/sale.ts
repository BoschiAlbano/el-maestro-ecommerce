import { roundToPeso } from "./money";

/**
 * Total de una venta (specs/008, sección 1): suma de cantidad × precio de
 * venta unitario de cada ítem, redondeado al peso (constitución, regla 6 —
 * es un monto calculado, no uno que se carga a mano).
 */
export type SaleItemForTotal = { quantity: number; unitSalePrice: number };

export function computeSaleTotal(items: SaleItemForTotal[]): number {
  const raw = items.reduce((sum, item) => sum + item.quantity * item.unitSalePrice, 0);
  return roundToPeso(raw);
}

/**
 * Los pagos de una venta tienen que sumar exactamente el total — sin
 * modelar "vuelto" (specs/008, sección 10).
 */
export function validatePayments(total: number, payments: { amount: number }[]): boolean {
  const sum = payments.reduce((acc, p) => acc + p.amount, 0);
  return roundToPeso(sum) === total;
}

export type PaymentStatus = {
  paid: number;
  /** Lo que falta cobrar (positivo) o lo que sobra (negativo). */
  remaining: number;
  status: "complete" | "missing" | "excess";
};

/** Estado del reparto del cobro frente al total (specs/008, RF-10): completo, falta o sobra. */
export function computePaymentStatus(total: number, payments: { amount: number }[]): PaymentStatus {
  const paid = roundToPeso(payments.reduce((acc, p) => acc + p.amount, 0));
  const remaining = roundToPeso(total - paid);
  return { paid, remaining, status: remaining === 0 ? "complete" : remaining > 0 ? "missing" : "excess" };
}

/**
 * Vuelto a devolver (specs/008, RF-11): el efectivo que entregó el cliente
 * menos la parte de la venta cobrada en efectivo. Es solo una ayuda en
 * pantalla — no se guarda ni cambia lo que se registra en la caja.
 */
export function computeChange(cashReceived: number, cashAmount: number): number {
  return Math.max(0, roundToPeso(cashReceived - cashAmount));
}
