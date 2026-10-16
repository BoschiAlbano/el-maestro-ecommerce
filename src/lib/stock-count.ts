/**
 * Conteo físico (specs/005, sección 4): compara lo contado contra lo
 * registrado y devuelve solo las diferencias reales. Un producto sin
 * contar (ausente de `countedByProductId`) no genera una diferencia — no
 * se asume que "no contado" signifique cero.
 */

export type ProductStock = { id: string; name: string; currentStock: number };

export type CountAdjustment = {
  productId: string;
  productName: string;
  registered: number;
  counted: number;
  delta: number;
};

export function computeCountAdjustments(
  products: ProductStock[],
  countedByProductId: Record<string, number>,
): CountAdjustment[] {
  const adjustments: CountAdjustment[] = [];

  for (const product of products) {
    const counted = countedByProductId[product.id];
    if (counted === undefined) continue;
    if (counted === product.currentStock) continue;

    adjustments.push({
      productId: product.id,
      productName: product.name,
      registered: product.currentStock,
      counted,
      delta: counted - product.currentStock,
    });
  }

  return adjustments;
}
