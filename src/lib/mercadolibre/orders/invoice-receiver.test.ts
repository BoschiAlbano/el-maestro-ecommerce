import { describe, expect, it } from "vitest";
import billingDni from "./__fixtures__/billing-info-dni.json";
import { billingInfoSchema, readBillingInfo, type BuyerFiscalData } from "./billing-read";
import { decideReceiver, receiverWasEdited } from "./invoice-receiver";

const withBilling = (changes: Record<string, unknown>) =>
  billingInfoSchema.parse({ ...billingDni, buyer: { ...billingDni.buyer, billing_info: { ...billingDni.buyer.billing_info, ...changes } } });

describe("readBillingInfo (specs/024, RF-4 y RF-5)", () => {
  it("la compradora de la prueba técnica: DNI y Consumidor Final", () => {
    expect(readBillingInfo(billingInfoSchema.parse(billingDni))).toEqual({
      docType: "DNI",
      docNumber: "1111111",
      name: "Test Test",
      ivaCondition: 5,
      address: "Calle Falsa 123 · San Miguel de Tucumán, Tucumán · CP 4000",
    });
  });

  it("un comprador con CUIT y Responsable Inscripto (código 01)", () => {
    const data = readBillingInfo(
      withBilling({
        name: "Ferretería del Norte SRL",
        last_name: null,
        identification: { type: "CUIT", number: "30-71234567-1" },
        taxes: { taxpayer_type: { id: "01", description: "IVA Responsable Inscripto" } },
      }),
    );
    expect(data).toMatchObject({ docType: "CUIT", docNumber: "30712345671", name: "Ferretería del Norte SRL", ivaCondition: 1 });
  });

  it("un código que el sistema no usa se resuelve por la descripción", () => {
    const data = readBillingInfo(withBilling({ taxes: { taxpayer_type: { id: "99", description: "Monotributo" } } }));
    expect(data.ivaCondition).toBe(6);
  });

  it("sin situación fiscal y con DNI: Consumidor Final (RF-5)", () => {
    expect(readBillingInfo(withBilling({ taxes: null })).ivaCondition).toBe(5);
  });

  it("sin documento: sin identificar y Consumidor Final", () => {
    expect(readBillingInfo(withBilling({ identification: null }))).toMatchObject({ docType: "NONE", docNumber: null, ivaCondition: 5 });
  });

  it("sin domicilio", () => {
    expect(readBillingInfo(withBilling({ address: null })).address).toBeNull();
  });
});

describe("decideReceiver (RF-6 y RF-7)", () => {
  const dni: BuyerFiscalData = { docType: "DNI", docNumber: "1111111", name: "Test Test", ivaCondition: 5, address: null };
  const none: BuyerFiscalData = { docType: "NONE", docNumber: null, name: null, ivaCondition: 5, address: null };
  const threshold = 10_000_000;

  it("con datos completos se identifica al comprador", () => {
    expect(decideReceiver(dni, 2500, threshold)).toEqual({ kind: "identified", receiver: dni });
  });

  it("sin documento y monto bajo: Consumidor Final", () => {
    const decision = decideReceiver(none, 2500, threshold);
    expect(decision.kind).toBe("final_consumer");
  });

  it("sin datos de Mercado Libre y monto bajo: Consumidor Final", () => {
    expect(decideReceiver(null, 2500, threshold).kind).toBe("final_consumer");
  });

  it("sin documento y monto alto: faltan datos, no se emite", () => {
    const decision = decideReceiver(none, threshold + 1, threshold);
    expect(decision.kind).toBe("missing");
    if (decision.kind === "missing") expect(decision.reason).toMatch(/cargalos a mano/);
  });

  it("un DNI inválido con monto bajo cae a Consumidor Final", () => {
    expect(decideReceiver({ ...dni, docNumber: "12" }, 2500, threshold).kind).toBe("final_consumer");
  });
});

describe("receiverWasEdited (RF-8)", () => {
  const proposed: BuyerFiscalData = { docType: "DNI", docNumber: "1111111", name: "Test Test", ivaCondition: 5, address: null };
  it("sin cambios", () => {
    expect(receiverWasEdited(proposed, { ...proposed })).toBe(false);
  });
  it("con otro nombre, documento o condición", () => {
    expect(receiverWasEdited(proposed, { ...proposed, name: "Otro" })).toBe(true);
    expect(receiverWasEdited(proposed, { ...proposed, docNumber: "22222222" })).toBe(true);
    expect(receiverWasEdited(proposed, { ...proposed, ivaCondition: 6 })).toBe(true);
  });
});
