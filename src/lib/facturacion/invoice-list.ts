import type { Prisma } from "@/generated/prisma/client";

// Filtros de la lista de comprobantes (specs/023, RF-24). Pura: la usan la
// página y la exportación a Excel, así las dos ven exactamente lo mismo.

export type InvoiceFilters = {
  /** AAAA-MM-DD, día de Tucumán. */
  from: string | null;
  to: string | null;
  status: "all" | "AUTHORIZED" | "PENDING";
  kind: "all" | "FACTURA_C" | "NOTA_CREDITO_C";
  /** Del local o de una orden de Mercado Libre (specs/024, RF-22). */
  origin: "all" | "LOCAL" | "MERCADO_LIBRE";
  /** `null` = el de la configuración (lo decide quien llama). */
  environment: "all" | "HOMOLOGACION" | "PRODUCCION" | null;
};

type Params = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const isDay = (value: string | undefined): value is string =>
  value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export function parseInvoiceFilters(params: Params): InvoiceFilters {
  const from = single(params.desde);
  const to = single(params.hasta);
  const status = single(params.estado);
  const kind = single(params.tipo);
  const environment = single(params.ambiente);
  const origin = single(params.origen);
  return {
    from: isDay(from) ? from : null,
    to: isDay(to) ? to : null,
    status: status === "AUTHORIZED" || status === "PENDING" ? status : "all",
    kind: kind === "FACTURA_C" || kind === "NOTA_CREDITO_C" ? kind : "all",
    origin: origin === "LOCAL" || origin === "MERCADO_LIBRE" ? origin : "all",
    environment:
      environment === "HOMOLOGACION" || environment === "PRODUCCION" ? environment : environment === "todos" ? "all" : null,
  };
}

/**
 * El filtro de la base. Los descartados nunca se muestran (nunca existieron en
 * ARCA). El rango de fechas es sobre el día de Tucumán en que se creó el
 * comprobante (UTC-3 todo el año: Argentina no usa horario de verano).
 */
export function invoiceWhere(filters: InvoiceFilters, defaultEnvironment: "HOMOLOGACION" | "PRODUCCION"): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { status: { not: "DISCARDED" } };
  if (filters.status !== "all") where.status = filters.status;
  if (filters.kind !== "all") where.kind = filters.kind;
  if (filters.origin !== "all") where.origin = filters.origin;

  const environment = filters.environment ?? defaultEnvironment;
  if (environment !== "all") where.environment = environment;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000-03:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999-03:00`) } : {}),
    };
  }
  return where;
}

/** Los filtros como parámetros de dirección, para los links de paginación y de exportación. */
export function filtersToQuery(filters: InvoiceFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.from) query.set("desde", filters.from);
  if (filters.to) query.set("hasta", filters.to);
  if (filters.status !== "all") query.set("estado", filters.status);
  if (filters.kind !== "all") query.set("tipo", filters.kind);
  if (filters.origin !== "all") query.set("origen", filters.origin);
  if (filters.environment === "all") query.set("ambiente", "todos");
  else if (filters.environment) query.set("ambiente", filters.environment);
  return query;
}

/** Facturas menos notas de crédito: lo que se facturó neto. */
export function netTotal(rows: { kind: "FACTURA_C" | "NOTA_CREDITO_C"; total: number }[]): number {
  return rows.reduce((sum, row) => sum + (row.kind === "FACTURA_C" ? row.total : -row.total), 0);
}
