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
    expect(prepareAvailability(base)).toEqual({ available: true });
    expect(prepareAvailability({ ...base, status: "READY_TO_SHIP" })).toEqual({ available: true });
  });

  it("riesgo de fraude, cancelada o ya despachada: no", () => {
    expect(prepareAvailability({ ...base, fraudRisk: true }).available).toBe(false);
    expect(prepareAvailability({ ...base, status: "CANCELLED" }).available).toBe(false);
    expect(prepareAvailability({ ...base, status: "SHIPPED" }).available).toBe(false);
  });

  it("sin los datos del emisor no se puede facturar", () => {
    const result = prepareAvailability({ ...base, emitterMissing: "el certificado de ARCA" });
    expect(result).toEqual({ available: false, reason: "Para facturar falta: el certificado de ARCA" });
  });

  it("si la compra ya tenía factura en Mercado Libre, no se factura otra vez", () => {
    expect(prepareAvailability({ ...base, invoiceState: "external" }).available).toBe(false);
  });

  it("con la factura ya emitida sigue disponible, para ver e imprimir (aunque falten datos del emisor)", () => {
    expect(prepareAvailability({ ...base, invoiceState: "not_uploaded", emitterMissing: "x" })).toEqual({ available: true });
  });
});
