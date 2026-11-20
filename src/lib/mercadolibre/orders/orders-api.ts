import "server-only";
import { z } from "zod";
import { mlFetch } from "../client";
import { MlApiError, MlUnavailableError } from "../errors";
import { getValidAccessToken } from "../tokens";
import { billingInfoSchema, type BillingInfo } from "./billing-read";
import {
  mlOrderSchema,
  mlPackSchema,
  mlShipmentCostsSchema,
  mlShipmentSchema,
  mlShipmentSlaSchema,
  type MlOrder,
  type MlPack,
  type MlShipment,
} from "./order-read";

// Llamadas a Mercado Libre sobre las compras de la cuenta conectada (specs/022,
// plan sección 3.1). Todas de lectura, salvo la etiqueta.

export function getOrder(id: string): Promise<MlOrder> {
  return mlFetch(`/orders/${id}`, { schema: mlOrderSchema });
}

export function getPack(id: string): Promise<MlPack> {
  return mlFetch(`/packs/${id}`, { schema: mlPackSchema });
}

export function getShipment(id: string): Promise<MlShipment> {
  return mlFetch(`/shipments/${id}`, { schema: mlShipmentSchema });
}

/** Fecha límite de despacho (RF-17). `null` si Mercado Libre no la informa. */
export async function getDispatchDeadline(shipmentId: string): Promise<Date | null> {
  const sla = await mlFetch(`/shipments/${shipmentId}/sla`, { schema: mlShipmentSlaSchema });
  return sla.expected_date ? new Date(sla.expected_date) : null;
}

/** Lo que paga el vendedor por el envío (RF-4). */
export async function getSellerShippingCost(shipmentId: string): Promise<string> {
  const costs = await mlFetch(`/shipments/${shipmentId}/costs`, { schema: mlShipmentCostsSchema });
  const total = (costs.senders ?? []).reduce((sum, s) => sum + (s.cost ?? 0), 0);
  return String(total);
}

const searchSchema = z.object({
  results: z.array(z.object({ id: z.union([z.number(), z.string()]).transform(String) })),
  paging: z.object({ total: z.number() }),
});

const SEARCH_PAGE = 50;
/** Tope de páginas por búsqueda: con 14 días de compras alcanza de sobra. */
const SEARCH_MAX_PAGES = 20;

/** Números de las órdenes de la cuenta creadas desde `from`, de la más nueva a la más vieja. */
export async function searchOrderIds(sellerId: string, from: Date): Promise<string[]> {
  const ids: string[] = [];
  const fromParam = encodeURIComponent(from.toISOString());
  for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
    const result = await mlFetch(
      `/orders/search?seller=${sellerId}&order.date_created.from=${fromParam}&sort=date_desc&limit=${SEARCH_PAGE}&offset=${page * SEARCH_PAGE}`,
      { schema: searchSchema },
    );
    ids.push(...result.results.map((r) => r.id));
    if ((page + 1) * SEARCH_PAGE >= result.paging.total) break;
  }
  return ids;
}

/**
 * La etiqueta de envío en PDF, tal como la da Mercado Libre: hoja A4 (plan,
 * sección 3.7). `null` si todavía no está disponible.
 */
export async function getLabelPdf(shipmentId: string): Promise<Uint8Array | null> {
  const token = await getValidAccessToken();
  let response: Response;
  try {
    response = await fetch(`https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MlUnavailableError();
  }
  if (response.status >= 500) throw new MlUnavailableError();
  if (!response.ok) {
    const body = await response.text();
    // Mercado Libre responde 4xx mientras la etiqueta todavía no se puede imprimir.
    if (response.status === 400 || response.status === 404) return null;
    throw new MlApiError(response.status, body);
  }
  if (!(response.headers.get("content-type") ?? "").includes("pdf")) return null;
  return new Uint8Array(await response.arrayBuffer());
}

/** Datos fiscales del comprador, versión 2 de la API (specs/024, prueba técnica). `null` si no hay. */
export async function getBillingInfo(billingInfoId: string): Promise<BillingInfo | null> {
  const response = await authorizedFetch(`/orders/billing-info/MLA/${billingInfoId}`, { headers: { "x-version": "2" } });
  if (response.status === 404) return null;
  if (!response.ok) throw await apiError(response);
  const parsed = billingInfoSchema.safeParse(await response.json());
  return parsed.success ? parsed.data : null;
}

export type FiscalDocument = { id: string; filename: string | null };

const fiscalDocumentsSchema = z.object({
  fiscal_documents: z.array(z.object({ id: z.string(), filename: z.string().nullable().optional() })).nullable().optional(),
});

/** Las facturas cargadas en la compra. Mercado Libre responde 404 cuando no hay ninguna. */
export async function listFiscalDocuments(packId: string): Promise<FiscalDocument[]> {
  const response = await authorizedFetch(`/packs/${packId}/fiscal_documents`);
  if (response.status === 404) return [];
  if (!response.ok) throw await apiError(response);
  const parsed = fiscalDocumentsSchema.safeParse(await response.json());
  return (parsed.success ? (parsed.data.fiscal_documents ?? []) : []).map((d) => ({ id: d.id, filename: d.filename ?? null }));
}

/** Mercado Libre ya tiene un archivo en esa compra: admite uno solo, y no se borra ni se reemplaza. */
export class FiscalDocumentExistsError extends Error {
  constructor() {
    super("La compra ya tiene una factura cargada en Mercado Libre.");
    this.name = "FiscalDocumentExistsError";
  }
}

/** Sube el PDF de la factura a la compra (specs/024, RF-13). Devuelve el id que da Mercado Libre. */
export async function uploadFiscalDocument(packId: string, pdf: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append("fiscal_document", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  const response = await authorizedFetch(`/packs/${packId}/fiscal_documents`, { method: "POST", body: form });
  if (response.status === 409) throw new FiscalDocumentExistsError();
  if (!response.ok) throw await apiError(response);
  const body = (await response.json().catch(() => null)) as { ids?: string[] } | null;
  return body?.ids?.[0] ?? "";
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  try {
    return await fetch(`https://api.mercadolibre.com${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MlUnavailableError();
  }
}

async function apiError(response: Response): Promise<Error> {
  if (response.status >= 500) return new MlUnavailableError();
  return new MlApiError(response.status, await response.text().catch(() => ""));
}
