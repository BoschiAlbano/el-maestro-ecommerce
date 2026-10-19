export type TravelListProduct = {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
};

export type TravelListItem = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  /** Unidades comprometidas en pedidos pendientes. */
  committed: number;
  available: number;
  suggested: number;
};

/**
 * Lista de viaje (specs/012, sección 2 del plan) — une en una sola regla
 * "bajo stock" y "comprometido en pedidos pendientes" (specs/009): un
 * producto entra cuando su disponible real (stock menos comprometido) es
 * menor que su mínimo, y la cantidad sugerida es la que falta para
 * cubrirlo. Reusada tanto por la alerta del inicio como por la lista
 * completa, para que nunca queden desincronizadas.
 */
export function computeTravelList(
  products: TravelListProduct[],
  committed: Map<string, number>,
): TravelListItem[] {
  const items: TravelListItem[] = [];
  for (const product of products) {
    const committedQty = committed.get(product.id) ?? 0;
    const available = product.currentStock - committedQty;
    if (available < product.minStock) {
      items.push({
        id: product.id,
        name: product.name,
        stock: product.currentStock,
        minStock: product.minStock,
        committed: committedQty,
        available,
        suggested: product.minStock - available,
      });
    }
  }
  return items;
}
