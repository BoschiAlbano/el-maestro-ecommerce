// Cuerpo del `PUT /items/{id}` que cambia una publicación (specs/020 y 021).
// Pura: se puede probar sin red.

export type ListingChanges = {
  /** Precio en pesos, como texto de un `Decimal`. */
  price?: string;
  quantity?: number;
  sku?: string;
  status?: "active" | "paused" | "closed";
};

/**
 * Con una variante, precio, cantidad y SKU van en ella: Mercado Libre los
 * rechaza en la publicación (specs/020, plan, cambio 2026-11-19). El estado va
 * siempre en la publicación.
 */
export function buildUpdateBody(changes: ListingChanges, variationId: string | null = null): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (changes.price !== undefined) fields.price = Number(changes.price);
  if (changes.quantity !== undefined) fields.available_quantity = changes.quantity;
  if (changes.sku !== undefined) fields.attributes = [{ id: "SELLER_SKU", value_name: changes.sku }];

  const body: Record<string, unknown> =
    variationId !== null && Object.keys(fields).length > 0 ? { variations: [{ id: Number(variationId), ...fields }] } : fields;
  if (changes.status !== undefined) body.status = changes.status;
  return body;
}
