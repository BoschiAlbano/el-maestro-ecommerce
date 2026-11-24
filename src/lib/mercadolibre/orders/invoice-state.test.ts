import { describe, expect, it } from "vitest";
import { orderInvoiceState, prepareAvailability } from "./invoice-state";

describe("orderInvoiceState (RF-15)", () => {
  it.each([
    [{ invoice: null, uploadedAt: null, externalInvoice: false }, "none"],
    [{ invoice: null, uploadedAt: null, externalInvoice: true }, "external"],
    [{ invoice: { status: "PENDING" as const }, uploadedAt: null, externalInvoice: false }, "pending"],
    [{ invoice: { status: "AUTHORIZED" as const }, uploadedAt: null, externalInvoice: false }, "not_uploaded"],
    [{ invoice: { status: "AUTHORIZED" as const }, uploadedAt: new Date(), externalInvoice: false }, "uploaded"],
    [{ invoice: { status: "AUTHORIZED" as const, hasCreditNote: true }, uploadedAt: new Date(), externalInvoice: false }, "voided"],
    [{ invoice: { status: "AUTHORIZED" as const, hasCreditNote: true }, uploadedAt: null, externalInvoice: false }, "voided"],
  ])("%j → %s", (input, expected) => {
    expect(orderInvoiceState(input)).toBe(expected);
  });
});

describe("prepareAvailability (RF-2)", () => {
  const base = { status: "TO_PREPARE" as const, fraudRisk: false, invoiceState: "none" as const, emitterMissing: null };

  it("una orden para preparar, sin factura y con el emisor completo", () => {
    expect(prepareAvailability(base)).toEqual({ available: true, mode: "prepare" });
    expect(prepareAvailability({ ...base, status: "READY_TO_SHIP" })).toEqual({ available: true, mode: "prepare" });
  });

  it("riesgo de fraude, cancelada o no entregada: no", () => {
    expect(prepareAvailability({ ...base, fraudRisk: true }).available).toBe(false);
    expect(prepareAvailability({ ...base, status: "CANCELLED" }).available).toBe(false);
    expect(prepareAvailability({ ...base, status: "NOT_DELIVERED" })).toEqual({ available: false, reason: "La compra no se entregó." });
  });

  it("despachada o entregada sin factura: «Facturar» (cambio 2026-11-24, RF-1b)", () => {
    expect(prepareAvailability({ ...base, status: "SHIPPED" })).toEqual({ available: true, mode: "invoice" });
    expect(prepareAvailability({ ...base, status: "DELIVERED" })).toEqual({ available: true, mode: "invoice" });
    // Con la factura de otro medio o sin los datos del emisor, tampoco (RF-2b).
    expect(prepareAvailability({ ...base, status: "DELIVERED", invoiceState: "external" }).available).toBe(false);
    expect(prepareAvailability({ ...base, status: "DELIVERED", emitterMissing: "el punto de venta" }).available).toBe(false);
  });

  it("sin los datos del emisor no se puede facturar", () => {
    const result = prepareAvailability({ ...base, emitterMissing: "el certificado de ARCA" });
    expect(result).toEqual({ available: false, reason: "Para facturar falta: el certificado de ARCA" });
  });

  it("si la compra ya tenía factura en Mercado Libre, no se factura otra vez", () => {
    expect(prepareAvailability({ ...base, invoiceState: "external" }).available).toBe(false);
  });

  it("con la factura ya emitida sigue disponible, para ver e imprimir (aunque falten datos del emisor)", () => {
    expect(prepareAvailability({ ...base, invoiceState: "not_uploaded", emitterMissing: "x" })).toEqual({ available: true, mode: "prepare" });
  });
});
