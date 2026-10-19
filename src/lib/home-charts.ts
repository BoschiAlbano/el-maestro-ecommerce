export type TopProduct = {
  key: string;
  label: string;
  cantidad: number;
  total: number;
};

/**
 * Los productos más vendidos de un conjunto de renglones de venta, por
 * unidades (specs/012, RF-11). Empata por importe y después por nombre, para
 * que el orden sea estable.
 */
export function topProductsByQuantity(
  items: { productId: string; productName: string; quantity: number; unitSalePrice: number }[],
  limit = 5,
): TopProduct[] {
  const byProduct = new Map<string, TopProduct>();
  for (const item of items) {
    const current = byProduct.get(item.productId) ?? {
      key: item.productId,
      label: item.productName,
      cantidad: 0,
      total: 0,
    };
    current.cantidad += item.quantity;
    current.total += item.quantity * item.unitSalePrice;
    byProduct.set(item.productId, current);
  }

  return [...byProduct.values()]
    .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total || a.label.localeCompare(b.label))
    .slice(0, limit);
}
