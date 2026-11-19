// Qué cambia en la publicación al vincularla (specs/020, RF-8). Al vincular
// manda el sistema: la publicación queda con el precio de venta, la cantidad
// según el stock y el SKU del producto. Pura.
import Decimal from "decimal.js";

export type PreviewProduct = {
  /** Precio de venta, como texto (de un `Decimal`). */
  salePrice: string;
  currentStock: number;
  sku: string | null;
};

export type PreviewListing = {
  price: string;
  quantity: number;
  sku: string | null;
};

export type Change<T> = { from: T; to: T; changes: boolean };

export type LinkPreview = {
  price: Change<string>;
  quantity: Change<number>;
  sku: Change<string | null>;
  /** El producto no tiene SKU y toma el de la publicación. */
  productTakesListingSku: boolean;
};

/** Cantidad que se publica: stock menos la reserva, nunca menos de cero (spec 021, RF-1). */
export function publishableQuantity(currentStock: number, reserve: number): number {
  return Math.max(0, currentStock - reserve);
}

export function buildLinkPreview(product: PreviewProduct, listing: PreviewListing, reserve = 0): LinkPreview {
  const priceTo = new Decimal(product.salePrice);
  const quantityTo = publishableQuantity(product.currentStock, reserve);
  const productTakesListingSku = product.sku === null && listing.sku !== null;
  const skuTo = product.sku ?? listing.sku;

  return {
    price: { from: listing.price, to: priceTo.toString(), changes: !priceTo.equals(listing.price) },
    quantity: { from: listing.quantity, to: quantityTo, changes: quantityTo !== listing.quantity },
    sku: { from: listing.sku, to: skuTo, changes: skuTo !== listing.sku },
    productTakesListingSku,
  };
}
