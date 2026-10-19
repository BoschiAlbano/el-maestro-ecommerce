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

/**
 * Valida la nueva cantidad pedida de una línea de un pedido (specs/009, RF-2):
 * entera, de al menos 1 y nunca menor a lo que ya se entregó de ese producto.
 * Devuelve el mensaje de error, o `null` si es válida. Función pura.
 */
export function validateOrderItemQuantity(quantity: number, delivered: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return "La cantidad tiene que ser un número entero de al menos 1.";
  if (quantity < delivered) return `Ya se entregaron ${delivered}: la cantidad no puede ser menor.`;
  return null;
}
