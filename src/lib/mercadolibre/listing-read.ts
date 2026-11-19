// Lectura de una publicación de Mercado Libre (specs/020). Valida con `zod` solo
// la parte que usa el sistema y decide si se puede vincular. Pura: sin I/O.
import { z } from "zod";

const attributeSchema = z.object({
  id: z.string(),
  value_name: z.string().nullable().optional(),
  values: z.array(z.object({ name: z.string().nullable().optional() })).nullable().optional(),
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
  variations: z.array(z.unknown()).nullable().optional(),
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
  /** Motivo por el que no se puede vincular, o `null` si se puede. */
  notLinkableReason: string | null;
};

function attributeValues(item: MlItem, id: string): string[] {
  const attr = item.attributes?.find((a) => a.id === id);
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
  if ((item.variations ?? []).length > 0) return "Tiene variantes (talles, colores): esta versión no las maneja.";
  if (item.shipping?.logistic_type === "fulfillment") {
    return "Se envía desde el depósito de Mercado Libre (Full): esta versión no lo maneja.";
  }
  return null;
}

export function readListing(item: MlItem): ListingRead {
  return {
    mlItemId: item.id,
    title: item.title,
    price: String(item.price),
    mlStatus: item.status,
    mlSubStatus: item.sub_status ?? [],
    quantity: item.available_quantity ?? 0,
    permalink: item.permalink,
    thumbnailUrl: httpsUrl(item.pictures?.[0]?.secure_url ?? item.thumbnail),
    categoryId: item.category_id ?? null,
    sku: attributeValues(item, "SELLER_SKU")[0] ?? null,
    gtins: attributeValues(item, "GTIN"),
    notLinkableReason: notLinkableReason(item),
  };
}

/** `/items/MLA123` o `/items/MLA123/prices` → `MLA123`. */
export function itemIdFromResource(resource: string): string | null {
  const match = /^\/items\/([A-Z]{3}\d+)(?:\/|$)/.exec(resource);
  return match ? match[1] : null;
}
