import "server-only";
import { z } from "zod";
import { mlFetch } from "./client";
import { MlApiError } from "./errors";
import { mlItemSchema, type MlItem } from "./listing-read";

// Llamadas a Mercado Libre sobre las publicaciones de la cuenta conectada
// (specs/020, plan sección 3.1). Las escrituras van todas por `PUT /items/{id}`
// y Mercado Libre responde con la publicación ya cambiada (prueba técnica).

/** Mercado Libre corta la búsqueda por páginas en 1000 resultados (plan, riesgo 4). */
const SEARCH_PAGE = 50;
const SEARCH_MAX = 1000;
/** Máximo de publicaciones por consulta de varias a la vez. */
const MULTIGET_MAX = 20;

const searchSchema = z.object({
  results: z.array(z.string()),
  paging: z.object({ total: z.number() }),
});

const multigetSchema = z.array(z.object({ code: z.number(), body: z.unknown() }));

export type MlListingStatusFilter = "active" | "paused" | "under_review" | "closed";

/** Identificadores de las publicaciones de la cuenta en esos estados. */
export async function searchListingIds(mlUserId: string, statuses: MlListingStatusFilter[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const status of statuses) {
    for (let offset = 0; offset < SEARCH_MAX; offset += SEARCH_PAGE) {
      const page = await mlFetch(
        `/users/${mlUserId}/items/search?status=${status}&limit=${SEARCH_PAGE}&offset=${offset}`,
        { schema: searchSchema },
      );
      for (const id of page.results) ids.add(id);
      if (offset + SEARCH_PAGE >= page.paging.total) break;
    }
  }
  return [...ids];
}

/**
 * Varias publicaciones por identificador, de a 20 por consulta. Las que
 * Mercado Libre no devuelve bien (borradas, de otra cuenta) se omiten.
 */
export async function getListings(ids: string[]): Promise<MlItem[]> {
  const items: MlItem[] = [];
  for (let i = 0; i < ids.length; i += MULTIGET_MAX) {
    const chunk = ids.slice(i, i + MULTIGET_MAX);
    const results = await mlFetch(`/items?ids=${chunk.join(",")}&include_attributes=all`, { schema: multigetSchema });
    for (const result of results) {
      if (result.code !== 200) continue;
      const parsed = mlItemSchema.safeParse(result.body);
      if (parsed.success) items.push(parsed.data);
    }
  }
  return items;
}

/** Una publicación. `include_attributes=all` hace falta para ver `SELLER_SKU`. */
export function getListing(id: string): Promise<MlItem> {
  return mlFetch(`/items/${id}?include_attributes=all`, { schema: mlItemSchema });
}

export type ListingChanges = {
  /** Precio en pesos, como texto de un `Decimal`. */
  price?: string;
  quantity?: number;
  sku?: string;
  status?: "active" | "paused" | "closed";
};

/** Cambia la publicación en una sola llamada y devuelve cómo quedó. */
export async function updateListing(id: string, changes: ListingChanges): Promise<MlItem> {
  const body: Record<string, unknown> = {};
  if (changes.price !== undefined) body.price = Number(changes.price);
  if (changes.quantity !== undefined) body.available_quantity = changes.quantity;
  if (changes.sku !== undefined) body.attributes = [{ id: "SELLER_SKU", value_name: changes.sku }];
  if (changes.status !== undefined) body.status = changes.status;
  // La respuesta trae la publicación completa, con el SKU (prueba técnica).
  return mlFetch(`/items/${id}`, { method: "PUT", json: body, schema: mlItemSchema });
}

/** Mensaje en español para un rechazo de Mercado Libre, con su motivo si lo trae. */
export function describeMlRejection(error: unknown): string | null {
  if (!(error instanceof MlApiError)) return null;
  const body = error.body as { message?: unknown; cause?: unknown } | null;
  const causes = Array.isArray(body?.cause)
    ? body.cause
        .map((c) => (c && typeof c === "object" && "message" in c ? String((c as { message: unknown }).message) : null))
        .filter((m): m is string => m !== null)
    : [];
  const detail = causes.length > 0 ? causes.join(" ") : typeof body?.message === "string" ? body.message : null;
  return detail ? `Mercado Libre rechazó el cambio: ${detail}` : error.message;
}
