import { describe, expect, it } from "vitest";
import { filtersToQuery, invoiceWhere, netTotal, parseInvoiceFilters } from "./invoice-list";

describe("parseInvoiceFilters", () => {
  it("sin parámetros no filtra nada y usa el ambiente de la configuración", () => {
    expect(parseInvoiceFilters({})).toEqual({ from: null, to: null, status: "all", kind: "all", environment: null });
  });

  it("lee fechas, estado, tipo y ambiente", () => {
    expect(
      parseInvoiceFilters({ desde: "2026-11-01", hasta: "2026-11-30", estado: "PENDING", tipo: "NOTA_CREDITO_C", ambiente: "PRODUCCION" }),
    ).toEqual({ from: "2026-11-01", to: "2026-11-30", status: "PENDING", kind: "NOTA_CREDITO_C", environment: "PRODUCCION" });
    expect(parseInvoiceFilters({ ambiente: "todos" }).environment).toBe("all");
  });

  it("ignora valores inventados en la dirección", () => {
    const filters = parseInvoiceFilters({ desde: "ayer", hasta: "2026-13-45", estado: "DISCARDED", tipo: "X", ambiente: "otro" });
    expect(filters).toEqual({ from: null, to: null, status: "all", kind: "all", environment: null });
  });
});

describe("invoiceWhere", () => {
  const base = parseInvoiceFilters({});

  it("nunca muestra los descartados y usa el ambiente por defecto", () => {
    expect(invoiceWhere(base, "HOMOLOGACION")).toEqual({ status: { not: "DISCARDED" }, environment: "HOMOLOGACION" });
  });

  it("'todos' los ambientes no filtra por ambiente", () => {
    expect(invoiceWhere({ ...base, environment: "all" }, "PRODUCCION")).toEqual({ status: { not: "DISCARDED" } });
  });

  it("el rango es por días de Tucumán, de las 00:00 a las 23:59 (UTC-3)", () => {
    const where = invoiceWhere({ ...base, from: "2026-11-01", to: "2026-11-30" }, "PRODUCCION");
    const range = where.createdAt as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2026-12-01T02:59:59.999Z");
  });

  it("un estado concreto reemplaza al 'no descartado'", () => {
    expect(invoiceWhere({ ...base, status: "PENDING" }, "PRODUCCION")).toMatchObject({ status: "PENDING", environment: "PRODUCCION" });
  });
});

describe("filtersToQuery", () => {
  it("ida y vuelta: lo que se escribe en la dirección se vuelve a leer igual", () => {
    const filters = parseInvoiceFilters({ desde: "2026-11-01", estado: "AUTHORIZED", ambiente: "todos" });
    const query = Object.fromEntries(filtersToQuery(filters));
    expect(parseInvoiceFilters(query)).toEqual(filters);
  });
});

describe("netTotal", () => {
  it("resta las notas de crédito", () => {
    expect(
      netTotal([
        { kind: "FACTURA_C", total: 1000 },
        { kind: "FACTURA_C", total: 500 },
        { kind: "NOTA_CREDITO_C", total: 300 },
      ]),
    ).toBe(1200);
  });
});
