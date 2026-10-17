/**
 * Cuánto de la seña disponible cubre una entrega, y cuánto hay que cobrar
 * aparte (specs/009, sección 4). Función pura.
 */
export function computeDepositApplication(
  remainingDeposit: number,
  saleTotal: number,
): { depositApplied: number; amountToCollect: number } {
  const depositApplied = Math.min(Math.max(remainingDeposit, 0), saleTotal);
  return { depositApplied, amountToCollect: saleTotal - depositApplied };
}

/**
 * Unidades comprometidas por producto en pedidos pendientes (specs/009,
 * sección 4) — ignora líneas ya completas. Función pura.
 */
export type OrderItemForCommitted = {
  productId: string;
  quantityOrdered: number;
  quantityDelivered: number;
};

export function computeCommittedQuantities(items: OrderItemForCommitted[]): Map<string, number> {
  const committed = new Map<string, number>();
  for (const item of items) {
    const pending = item.quantityOrdered - item.quantityDelivered;
    if (pending <= 0) continue;
    committed.set(item.productId, (committed.get(item.productId) ?? 0) + pending);
  }
  return committed;
}
