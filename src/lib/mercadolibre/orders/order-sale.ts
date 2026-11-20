// La venta del sistema a partir de una compra de Mercado Libre: una orden o un
// paquete (specs/022, plan sección 3.2). Pura.
import Decimal from "decimal.js";
import type { OrderItemRead, OrderRead } from "./order-read";

export type MlSaleItem = OrderItemRead & {
  /** Producto vinculado a la publicación; `null` si no estaba vinculada. */
  productId: string | null;
};

export type MlSale = {
  /** Lo que pagó el comprador por los productos, sumado de las órdenes. */
  total: string;
  /** Lo que cobró Mercado Libre: `sale_fee × cantidad` de cada ítem (RF-4). */
  mlFee: string;
  sellerShippingCost: string;
  net: string;
  items: MlSaleItem[];
  /** Motivo para revisar la orden, si algún ítem no estaba vinculado. */
  needsReview: string | null;
};

/**
 * Arma la venta. `links` va de la publicación (`mlItemId`) al producto
 * vinculado. Un ítem sin vincular queda en la orden sin producto, no descuenta
 * stock y marca la orden para revisar (spec, sección 7).
 */
export function buildMlSale(orders: OrderRead[], links: Map<string, string>, sellerShippingCost: string = "0"): MlSale {
  const items: MlSaleItem[] = orders.flatMap((o) => o.items.map((i) => ({ ...i, productId: links.get(i.mlItemId) ?? null })));
  const total = orders.reduce((sum, o) => sum.plus(o.total), new Decimal(0));
  const mlFee = items.reduce((sum, i) => sum.plus(new Decimal(i.saleFee).times(i.quantity)), new Decimal(0));
  const shipping = new Decimal(sellerShippingCost);

  const unlinked = items.filter((i) => i.productId === null);
  const needsReview =
    unlinked.length === 0
      ? null
      : `${unlinked.length === 1 ? "Un producto" : `${unlinked.length} productos`} de una publicación sin vincular: no descontaron stock (${unlinked
          .map((i) => i.title)
          .join(", ")}).`;

  return {
    total: total.toString(),
    mlFee: mlFee.toString(),
    sellerShippingCost: shipping.toString(),
    net: total.minus(mlFee).minus(shipping).toString(),
    items,
    needsReview,
  };
}

/** Todas las órdenes del paquete pagadas: recién ahí se registra la compra (RF-9). */
export function isPurchasePaid(orders: OrderRead[]): boolean {
  return orders.length > 0 && orders.every((o) => o.paid);
}

/** La compra se cancela entera si se cancelan todas sus órdenes. */
export function isPurchaseCancelled(orders: OrderRead[]): boolean {
  return orders.length > 0 && orders.every((o) => o.cancelled);
}

/** Una parte del paquete cancelada y otra no: hay que revisarla en Mercado Libre (spec, sección 7). */
export function isPartiallyCancelled(orders: OrderRead[]): boolean {
  return orders.some((o) => o.cancelled) && !isPurchaseCancelled(orders);
}

/** La compra es anterior a la fecha de inicio, o no hay fecha cargada (RF-9b). */
export function isBeforeStart(createdAt: Date, startDate: Date | null): boolean {
  return startDate === null || createdAt < startDate;
}

/**
 * Cómo se nombra una compra en los avisos: número y productos, para distinguir
 * dos compras del mismo comprador. «#123 (1 × Billetera)» o «#123 (2 productos)».
 */
export function describePurchase(number: string, items: { title: string; quantity: number }[]): string {
  if (items.length === 1) return `#${number} (${items[0].quantity} × ${items[0].title})`;
  return `#${number} (${items.length} productos)`;
}
