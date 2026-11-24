// El cuerpo que se manda a Mercado Libre para crear una publicación o editar
// su contenido (specs/025, RF-2, RF-7 y RF-9; prueba técnica). Pura.
import type { AttributeValue } from "./category-form";
import { gtinDecision, photoUrls, type CategoryRules, type ProductForPublication, type PublicationData, type WarrantyType } from "./publication-rules";

/** Códigos de Mercado Libre del tipo de garantía (`sale_terms` de la categoría, prueba técnica). */
export const WARRANTY_TYPE_IDS: Record<WarrantyType | "NONE", string> = {
  SELLER: "2230280",
  FACTORY: "2230279",
  NONE: "6150835",
};

type MlAttribute = { id: string; value_id?: string; value_name?: string };

function toMl(value: AttributeValue): MlAttribute | null {
  const valueId = (value.valueId ?? "").trim();
  const valueName = (value.valueName ?? "").trim();
  if (!valueId && !valueName) return null;
  return { id: value.id, ...(valueId ? { value_id: valueId } : {}), ...(valueName ? { value_name: valueName } : {}) };
}

/** Características: las del formulario, más SKU, código universal y paquete, que arma el sistema. */
export function buildAttributes(data: PublicationData, product: ProductForPublication, rules: Pick<CategoryRules, "gtin">): MlAttribute[] {
  const attributes = data.attributes.map(toMl).filter((a): a is MlAttribute => a !== null);
  if (product.sku?.trim()) attributes.push({ id: "SELLER_SKU", value_name: product.sku.trim() });
  const gtin = gtinDecision(product, rules.gtin);
  if (gtin.kind === "send") attributes.push({ id: "GTIN", value_name: gtin.value });
  if (gtin.kind === "empty" && data.emptyGtinReason) attributes.push({ id: "EMPTY_GTIN_REASON", value_id: data.emptyGtinReason });
  const pkg: [string, number | null, string][] = [
    ["SELLER_PACKAGE_HEIGHT", data.packageHeightCm, "cm"],
    ["SELLER_PACKAGE_WIDTH", data.packageWidthCm, "cm"],
    ["SELLER_PACKAGE_LENGTH", data.packageLengthCm, "cm"],
    ["SELLER_PACKAGE_WEIGHT", data.packageWeightG, "g"],
  ];
  for (const [id, value, unit] of pkg) if (value) attributes.push({ id, value_name: `${value} ${unit}` });
  return attributes;
}

export function buildSaleTerms(data: Pick<PublicationData, "warrantyType" | "warrantyDays">) {
  if (!data.warrantyType) return [{ id: "WARRANTY_TYPE", value_id: WARRANTY_TYPE_IDS.NONE }];
  return [
    { id: "WARRANTY_TYPE", value_id: WARRANTY_TYPE_IDS[data.warrantyType] },
    { id: "WARRANTY_TIME", value_name: `${data.warrantyDays} días` },
  ];
}

/**
 * Mercado Envíos, como hoy (spec 022), y retiro en el local si se eligió. El
 * envío gratis no se manda: cuando corresponde por el precio, lo impone
 * Mercado Libre.
 */
export function buildShipping(data: Pick<PublicationData, "localPickUp">) {
  return { mode: "me2", local_pick_up: data.localPickUp };
}

/**
 * El alta (`POST /items` y `/items/validate`). Siempre nuevo (RF-3), con la
 * cantidad de la spec 021: con 0 Mercado Libre la crea pausada por falta de
 * stock (prueba técnica, T-002).
 */
export function buildCreateBody(data: PublicationData, product: ProductForPublication, rules: CategoryRules, quantity: number) {
  return {
    title: data.title.trim(),
    category_id: data.categoryId,
    price: Number(product.salePrice),
    currency_id: "ARS",
    available_quantity: Math.max(0, Math.trunc(quantity)),
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: data.listingType,
    pictures: photoUrls(data, product).map((source) => ({ source })),
    description: { plain_text: data.description.trim() },
    attributes: buildAttributes(data, product, rules),
    sale_terms: buildSaleTerms(data),
    shipping: buildShipping(data),
  };
}

/**
 * Edición del contenido (RF-9): solo lo que cambió respecto de lo último que
 * se mandó. Precio y cantidad no van: los manejan las specs 020 y 021. La
 * descripción se manda aparte (`PUT /items/{id}/description`).
 */
export function buildUpdateBody(
  before: PublicationData,
  after: PublicationData,
  product: ProductForPublication,
  rules: Pick<CategoryRules, "gtin">,
): { item: Record<string, unknown>; description: string | null } {
  const item: Record<string, unknown> = {};
  if (before.title.trim() !== after.title.trim()) item.title = after.title.trim();
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const photosAfter = photoUrls(after, product);
  if (!same(photoUrls(before, product), photosAfter)) item.pictures = photosAfter.map((source) => ({ source }));
  const attributesAfter = buildAttributes(after, product, rules);
  if (!same(buildAttributes(before, product, rules), attributesAfter)) item.attributes = attributesAfter;
  if (!same(buildSaleTerms(before), buildSaleTerms(after))) item.sale_terms = buildSaleTerms(after);
  if (before.localPickUp !== after.localPickUp) item.shipping = buildShipping(after);
  const description = before.description.trim() !== after.description.trim() ? after.description.trim() : null;
  return { item, description };
}
