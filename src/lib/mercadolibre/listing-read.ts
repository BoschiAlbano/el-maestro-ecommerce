// Lectura de una publicación de Mercado Libre (specs/020). Valida con `zod` solo
// la parte que usa el sistema y decide si se puede vincular. Pura: sin I/O.
import { z } from "zod";

const attributeSchema = z.object({
  id: z.string(),
  value_name: z.string().nullable().optional(),
  values: z.array(z.object({ name: z.string().nullable().optional() })).nullable().optional(),
});

/** Una variante de la publicación (specs/020, cambio 2026-11-19). */
const variationSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  price: z.number().nullable().optional(),
  available_quantity: z.number().int().nullable().optional(),
  attributes: z.array(attributeSchema).nullable().optional(),
});

export const mlItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  status: z.string(),
  sub_status: z.array(z.string()).nullable().optional(),
  available_quantity: z.number().int().nullable().optional(),
  permalink: z.string(),
  thumbnail: z.string().nullable().optional(),
  pictures: z.array(z.object({ secure_url: z.string().nullable().optional() })).nullable().optional(),
  category_id: z.string().nullable().optional(),
  variations: z.array(variationSchema).nullable().optional(),
  shipping: z.object({ logistic_type: z.string().nullable().optional() }).nullable().optional(),
  attributes: z.array(attributeSchema).nullable().optional(),
  last_updated: z.string().nullable().optional(),
});

export type MlItem = z.infer<typeof mlItemSchema>;

export type ListingRead = {
  mlItemId: string;
  title: string;
  /** En pesos, como texto para pasarlo a `Decimal` sin errores de redondeo. */
  price: string;
  mlStatus: string;
  mlSubStatus: string[];
  quantity: number;
  permalink: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  /** Valor de la característica `SELLER_SKU`, recortado; `null` si no tiene. */
  sku: string | null;
  /** Códigos universales (`GTIN`); puede haber varios. */
  gtins: string[];
  /**
   * La única variante, si la publicación tiene exactamente una: precio,
   * cantidad, SKU y códigos salen de ahí y se mandan ahí (specs/020, cambio
   * 2026-11-19). `null` sin variantes, o con dos o más.
   */
  variationId: string | null;
  /** Cuántas variantes tiene: con dos o más el sistema no la administra. */
  variationCount: number;
  /** Motivo por el que no se puede vincular, o `null` si se puede. */
  notLinkableReason: string | null;
};

type Attribute = z.infer<typeof attributeSchema>;

function attributeValues(attributes: Attribute[] | null | undefined, id: string): string[] {
  const attr = attributes?.find((a) => a.id === id);
  if (!attr) return [];
  const fromValues = (attr.values ?? []).map((v) => v.name?.trim() ?? "").filter((v) => v !== "");
  if (fromValues.length > 0) return fromValues;
  const single = attr.value_name?.trim();
  return single ? [single] : [];
}

function httpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

export function notLinkableReason(item: MlItem): string | null {
  if (item.status === "closed") return "La publicación está finalizada.";
  const variations = (item.variations ?? []).length;
  // Una sola variante («variante principal») se trata como el producto.
  if (variations > 1) return `Tiene ${variations} variantes (talles, colores): esta versión maneja publicaciones con una sola.`;
  if (item.shipping?.logistic_type === "fulfillment") {
    return "Se envía desde el depósito de Mercado Libre (Full): esta versión no lo maneja.";
  }
  return null;
}

export function readListing(item: MlItem): ListingRead {
  const variations = item.variations ?? [];
  const single = variations.length === 1 ? variations[0] : null;
  // Con una variante, el SKU y los códigos están en ella; si no, en la publicación.
  const sku = attributeValues(single?.attributes, "SELLER_SKU")[0] ?? attributeValues(item.attributes, "SELLER_SKU")[0] ?? null;
  const variantGtins = attributeValues(single?.attributes, "GTIN");
  return {
    mlItemId: item.id,
    title: item.title,
    price: String(single?.price ?? item.price),
    mlStatus: item.status,
    mlSubStatus: item.sub_status ?? [],
    quantity: single?.available_quantity ?? item.available_quantity ?? 0,
    permalink: item.permalink,
    thumbnailUrl: httpsUrl(item.pictures?.[0]?.secure_url ?? item.thumbnail),
    categoryId: item.category_id ?? null,
    sku,
    gtins: variantGtins.length > 0 ? variantGtins : attributeValues(item.attributes, "GTIN"),
    variationId: single?.id ?? null,
    variationCount: variations.length,
    notLinkableReason: notLinkableReason(item),
  };
}

/** `/items/MLA123` o `/items/MLA123/prices` → `MLA123`. */
export function itemIdFromResource(resource: string): string | null {
  const match = /^\/items\/([A-Z]{3}\d+)(?:\/|$)/.exec(resource);
  return match ? match[1] : null;
}
