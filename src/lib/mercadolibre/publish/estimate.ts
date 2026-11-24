// La estimación de lo que cobra Mercado Libre y de lo que queda antes de
// publicar (specs/025, RF-4; prueba técnica). Pura. Montos en `Decimal`
// (constitución, regla 6).
import Decimal from "decimal.js";
import type { ListingType } from "./publication-rules";

/** Lo que usa el sistema de cada tipo en `GET /sites/MLA/listing_prices`. */
export type MlListingPrice = {
  listing_type_id: string;
  listing_type_name?: string;
  sale_fee_amount: number;
  sale_fee_details?: { percentage_fee?: number; fixed_fee?: number; financing_add_on_fee?: number };
};

export type Estimate = {
  price: string;
  /** Lo que cobra Mercado Libre por la venta, con el cargo fijo y las cuotas sin interés si es Premium. */
  fee: string;
  percentage: number;
  fixedFee: string;
  /** Lo que paga el vendedor por el envío gratis; 0 si no corresponde. */
  shippingCost: string;
  /** Precio menos comisión y envío. */
  net: string;
  /** Solo con el permiso «ver costos y márgenes» (constitución, regla 17). */
  margin: { purchasePrice: string; amount: string } | null;
};

/**
 * Para el tipo de publicación elegido. `null` si Mercado Libre no informó ese
 * tipo. `shippingCost`: el `list_cost` de `/users/{id}/shipping_options/free`
 * (0 cuando el precio no exige envío gratis).
 */
export function estimate(input: {
  price: string;
  listingType: ListingType;
  prices: readonly MlListingPrice[];
  shippingCost: number | null;
  /** `null` sin el permiso de costos. */
  purchasePrice: string | null;
}): Estimate | null {
  const row = input.prices.find((p) => p.listing_type_id === input.listingType);
  if (!row) return null;
  const price = new Decimal(input.price);
  const fee = new Decimal(row.sale_fee_amount);
  const shipping = new Decimal(input.shippingCost ?? 0);
  const net = price.minus(fee).minus(shipping);
  return {
    price: price.toFixed(2),
    fee: fee.toFixed(2),
    percentage: row.sale_fee_details?.percentage_fee ?? 0,
    fixedFee: new Decimal(row.sale_fee_details?.fixed_fee ?? 0).toFixed(2),
    shippingCost: shipping.toFixed(2),
    net: net.toFixed(2),
    margin: input.purchasePrice === null ? null : { purchasePrice: new Decimal(input.purchasePrice).toFixed(2), amount: net.minus(input.purchasePrice).toFixed(2) },
  };
}
