import "server-only";
import { z } from "zod";
import { mlFetch } from "../client";
import { MlApiError } from "../errors";
import { mlItemSchema, type MlItem } from "../listing-read";
import type { MlCategoryAttribute } from "./category-form";
import type { MlListingPrice } from "./estimate";
import { causesOf, classifyCauses, type ReviewResult } from "./ml-validation";
import type { ListingType } from "./publication-rules";

// Llamadas a Mercado Libre para publicar desde el sistema (specs/025, plan
// sección 3.1; prueba técnica). Las respuestas se validan con `zod` solo en lo
// que usa el sistema.

/** Categoría y características cambian poco y el formulario las pide seguido: se guardan una hora en memoria. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const suggestionSchema = z.array(
  z.object({
    category_id: z.string(),
    category_name: z.string(),
    domain_name: z.string().nullable().optional(),
    attributes: z
      .array(z.object({ id: z.string(), value_id: z.string().nullable().optional(), value_name: z.string().nullable().optional() }))
      .nullable()
      .optional(),
  }),
);

export type CategorySuggestion = {
  categoryId: string;
  categoryName: string;
  domainName: string | null;
  /** Características que Mercado Libre deduce del título (por ejemplo, los conectores de un cable). */
  attributes: { id: string; value_id?: string | null; value_name?: string | null }[];
};

/** Hasta tres categorías sugeridas para el título (RF-2). */
export async function suggestCategories(title: string): Promise<CategorySuggestion[]> {
  const q = title.trim();
  if (!q) return [];
  const result = await mlFetch(`/sites/MLA/domain_discovery/search?limit=3&q=${encodeURIComponent(q)}`, { schema: suggestionSchema });
  return result.map((s) => ({ categoryId: s.category_id, categoryName: s.category_name, domainName: s.domain_name ?? null, attributes: s.attributes ?? [] }));
}

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path_from_root: z.array(z.object({ name: z.string() })).nullable().optional(),
  settings: z
    .object({
      max_title_length: z.number().nullable().optional(),
      max_pictures_per_item: z.number().nullable().optional(),
      minimum_price: z.number().nullable().optional(),
      listing_allowed: z.boolean().nullable().optional(),
    })
    .passthrough(),
});

export type CategoryInfo = {
  id: string;
  name: string;
  /** «Celulares y Teléfonos › Accesorios para Celulares › Cables de Datos». */
  path: string;
  maxTitleLength: number;
  maxPictures: number;
  minimumPrice: number | null;
  listingAllowed: boolean;
};

export function getCategory(categoryId: string): Promise<CategoryInfo> {
  return cached(`category:${categoryId}`, async () => {
    const c = await mlFetch(`/categories/${encodeURIComponent(categoryId)}`, { schema: categorySchema });
    return {
      id: c.id,
      name: c.name,
      path: (c.path_from_root ?? []).map((p) => p.name).join(" › ") || c.name,
      maxTitleLength: c.settings.max_title_length ?? 60,
      maxPictures: c.settings.max_pictures_per_item ?? 12,
      minimumPrice: c.settings.minimum_price ?? null,
      listingAllowed: c.settings.listing_allowed !== false,
    };
  });
}

const attributeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    value_type: z.string(),
    tags: z.record(z.string(), z.boolean().optional()).nullable().optional(),
    values: z.array(z.object({ id: z.string(), name: z.string() })).nullable().optional(),
    allowed_units: z.array(z.object({ id: z.string(), name: z.string() })).nullable().optional(),
    default_unit: z.string().nullable().optional(),
    value_max_length: z.number().nullable().optional(),
    hint: z.string().nullable().optional(),
    tooltip: z.string().nullable().optional(),
    relevance: z.number().nullable().optional(),
  })
  .transform(
    (a): MlCategoryAttribute => ({
      id: a.id,
      name: a.name,
      value_type: a.value_type,
      tags: a.tags ?? {},
      values: a.values ?? [],
      allowed_units: a.allowed_units ?? [],
      default_unit: a.default_unit ?? undefined,
      value_max_length: a.value_max_length ?? undefined,
      hint: a.hint ?? undefined,
      tooltip: a.tooltip ?? undefined,
      relevance: a.relevance ?? undefined,
    }),
  );

export function getCategoryAttributes(categoryId: string): Promise<MlCategoryAttribute[]> {
  return cached(`attributes:${categoryId}`, () =>
    mlFetch(`/categories/${encodeURIComponent(categoryId)}/attributes`, { schema: z.array(attributeSchema) }),
  );
}

const listingPricesSchema = z.array(
  z.object({
    listing_type_id: z.string(),
    listing_type_name: z.string().optional(),
    sale_fee_amount: z.number(),
    sale_fee_details: z
      .object({ percentage_fee: z.number().optional(), fixed_fee: z.number().optional(), financing_add_on_fee: z.number().optional() })
      .partial()
      .optional(),
  }),
);

/** Lo que cobra Mercado Libre por cada tipo de publicación a ese precio (RF-4). */
export function getListingPrices(price: number, categoryId: string): Promise<MlListingPrice[]> {
  return mlFetch(`/sites/MLA/listing_prices?price=${price}&category_id=${encodeURIComponent(categoryId)}`, { schema: listingPricesSchema });
}

const freeShippingSchema = z.object({
  coverage: z.object({ all_country: z.object({ list_cost: z.number() }).nullable().optional() }).nullable().optional(),
});

/**
 * Lo que paga el vendedor por el envío gratis, con el paquete embalado (RF-4).
 * 0 cuando el precio no lo exige. `null` si Mercado Libre no lo informa.
 */
export async function getFreeShippingCost(input: {
  mlUserId: string;
  price: number;
  listingType: ListingType;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightG: number;
}): Promise<number | null> {
  const dimensions = `${input.heightCm}x${input.widthCm}x${input.lengthCm},${input.weightG}`;
  const result = await mlFetch(
    `/users/${input.mlUserId}/shipping_options/free?dimensions=${encodeURIComponent(dimensions)}&item_price=${input.price}&listing_type_id=${input.listingType}&condition=new&mode=me2`,
    { schema: freeShippingSchema },
  );
  return result.coverage?.all_country?.list_cost ?? null;
}

/**
 * Revisión previa sin crear nada (`POST /items/validate`, RF-6). Mercado Libre
 * responde 400 aunque solo haya advertencias: lo que decide es el tipo de cada
 * causa (prueba técnica, T-002). `names`: las características por id, para
 * nombrarlas como en el formulario.
 */
export async function validateItem(body: unknown, names: Record<string, string> = {}): Promise<ReviewResult> {
  try {
    await mlFetch("/items/validate", { method: "POST", json: body, schema: z.unknown() });
    return { errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof MlApiError && error.status >= 400 && error.status < 500) {
      return classifyCauses(causesOf(error.body), names);
    }
    throw error;
  }
}

/** Crea la publicación (`POST /items`, RF-7). Un rechazo llega como `MlApiError` con sus causas. */
export function createItem(body: unknown): Promise<MlItem> {
  return mlFetch("/items", { method: "POST", json: body, schema: mlItemSchema });
}

/** Cambia el contenido de una publicación (RF-9). */
export function updateItem(mlItemId: string, body: Record<string, unknown>): Promise<MlItem> {
  return mlFetch(`/items/${mlItemId}`, { method: "PUT", json: body, schema: mlItemSchema });
}

export async function updateDescription(mlItemId: string, text: string): Promise<void> {
  await mlFetch(`/items/${mlItemId}/description`, { method: "PUT", json: { plain_text: text }, schema: z.unknown() });
}

const searchSchema = z.object({ results: z.array(z.union([z.string(), z.number()]).transform(String)) });

/**
 * La publicación con ese SKU, si existe (plan, sección 3.4): para saber si una
 * publicación sin respuesta se llegó a crear. Solo vigentes y pausadas.
 */
export async function findListingIdBySku(mlUserId: string, sku: string): Promise<string | null> {
  const result = await mlFetch(`/users/${mlUserId}/items/search?seller_sku=${encodeURIComponent(sku)}&status=active,paused&limit=5`, {
    schema: searchSchema,
  });
  return result.results[0] ?? null;
}
