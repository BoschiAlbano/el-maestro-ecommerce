import { describe, expect, it } from "vitest";
import { EMPTY_INVOICE_FORM, buildInvoiceRequest, withDocType, type InvoiceForm } from "./invoice-form";

const THRESHOLD = 417288;
const on = (patch: Partial<InvoiceForm> = {}): InvoiceForm => ({ ...EMPTY_INVOICE_FORM, enabled: true, ...patch });

describe("buildInvoiceRequest", () => {
  it("sin factura pedida no hay pedido ni error", () => {
    expect(buildInvoiceRequest(EMPTY_INVOICE_FORM, 5000, THRESHOLD)).toEqual({ request: null, error: null });
  });

  it("por defecto es Consumidor Final", () => {
    expect(buildInvoiceRequest(on(), 5000, THRESHOLD)).toEqual({
      request: { receiver: { docType: "NONE", ivaCondition: 5 } },
      error: null,
    });
  });

  it("desde el monto de identificación, Consumidor Final sin datos no alcanza", () => {
    const result = buildInvoiceRequest(on(), THRESHOLD, THRESHOLD);
    expect(result.request).toBeNull();
    expect(result.error).toMatch(/identificar al comprador/);
  });

  it("con DNI válido y nombre, pide la factura al Consumidor Final identificado", () => {
    const result = buildInvoiceRequest(on({ identify: true, docNumber: "12.345.678", name: " Ana Pérez " }), 5000, THRESHOLD);
    expect(result.error).toBeNull();
    expect(result.request).toEqual({
      receiver: { docType: "DNI", docNumber: "12345678", name: "Ana Pérez", ivaCondition: 5 },
    });
  });

  it("rechaza un DNI mal escrito y un nombre vacío", () => {
    expect(buildInvoiceRequest(on({ identify: true, docNumber: "123", name: "Ana" }), 5000, THRESHOLD).error).not.toBeNull();
    expect(buildInvoiceRequest(on({ identify: true, docNumber: "12345678", name: "  " }), 5000, THRESHOLD).error).toMatch(/nombre/i);
  });

  it("rechaza un CUIT con dígito verificador incorrecto y acepta uno bueno", () => {
    expect(buildInvoiceRequest(withDocTypeOn("CUIT", { docNumber: "20111111111", name: "Casa Uno" }), 5000, THRESHOLD).error).not.toBeNull();
    const ok = buildInvoiceRequest(withDocTypeOn("CUIT", { docNumber: "20-11111111-2", name: "Casa Uno" }), 5000, THRESHOLD);
    expect(ok.error).toBeNull();
    expect(ok.request?.receiver).toMatchObject({ docType: "CUIT", docNumber: "20111111112", ivaCondition: 1 });
  });

  it("rechaza una condición frente al IVA que no se ofrece", () => {
    expect(buildInvoiceRequest(on({ identify: true, docNumber: "12345678", name: "Ana", ivaCondition: 99 }), 5000, THRESHOLD).error).toMatch(/condición/i);
  });
});

describe("withDocType", () => {
  it("el CUIT lleva a Responsable Inscripto y el DNI a Consumidor Final", () => {
    expect(withDocType(on(), "CUIT").ivaCondition).toBe(1);
    expect(withDocType(withDocType(on(), "CUIT"), "DNI").ivaCondition).toBe(5);
  });
});

function withDocTypeOn(docType: "DNI" | "CUIT", patch: Partial<InvoiceForm>): InvoiceForm {
  return withDocType(on({ identify: true, ...patch }), docType);
}
