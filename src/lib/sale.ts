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
