import { describe, expect, it } from "vitest";
import {
  TEST_LEGEND,
  buildInvoiceTicketHtml,
  formatCuit,
  formatInvoiceNumber,
  formatIsoDate,
  formatMoneyAr,
  type InvoiceView,
} from "./invoice-document";

const view: InvoiceView = {
  id: "i1",
  kind: "FACTURA_C",
  status: "AUTHORIZED",
  environment: "PRODUCCION",
  saleId: "s1",
  ticketNumber: 42,
  pointOfSale: 1,
  number: 75,
  issueDate: "2026-11-11",
  cae: "76458123456789",
  caeExpiresAt: "2026-11-21",
  total: 3500,
  emitter: {
    razonSocial: "Casa <Prueba> & Cía",
    cuit: "20111111112",
    domicilioComercial: "Calle 123, Tucumán",
    iibb: "123-456",
    inicioActividades: "2020-03-01",
    condicionIva: "Responsable Monotributo",
  },
  receiver: { docLabel: "DNI 12345678", name: "Ana Pérez", ivaLabel: "Consumidor Final" },
  items: [{ description: "Tuerca 1/2", quantity: 2, unitPrice: 1750, subtotal: 3500 }],
  relatedNumberLabel: null,
  qrDataUrl: "data:image/png;base64,AAAA",
  lastError: null,
};

describe("formato", () => {
  it("el número lleva punto de venta y comprobante con ceros", () => {
    expect(formatInvoiceNumber(1, 75)).toBe("0001-00000075");
    expect(formatInvoiceNumber(12, 123456)).toBe("0012-00123456");
  });
  it("CUIT con guiones, fecha y monto a la argentina", () => {
    expect(formatCuit("20111111112")).toBe("20-11111111-2");
    expect(formatIsoDate("2026-11-11")).toBe("11/11/2026");
    expect(formatMoneyAr(1234.5)).toBe("$1.234,50");
  });
});

describe("buildInvoiceTicketHtml", () => {
  it("lleva lo que exige un comprobante C: emisor, tipo, número, fecha, comprador, total, CAE y QR", () => {
    const html = buildInvoiceTicketHtml(view);
    expect(html).toContain("FACTURA C");
    expect(html).toContain("Cód. 011");
    expect(html).toContain("0001-00000075");
    expect(html).toContain("20-11111111-2");
    expect(html).toContain("Responsable Monotributo");
    expect(html).toContain("11/11/2026");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("DNI 12345678");
    expect(html).toContain("$3.500,00");
    expect(html).toContain("CAE: 76458123456789");
    expect(html).toContain("Vto. CAE: 21/11/2026");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("escapa el texto que viene de afuera", () => {
    const html = buildInvoiceTicketHtml(view);
    expect(html).toContain("Casa &lt;Prueba&gt; &amp; Cía");
    expect(html).not.toContain("<Prueba>");
  });

  it("en pruebas lleva la leyenda de sin validez fiscal; en producción no", () => {
    expect(buildInvoiceTicketHtml({ ...view, environment: "HOMOLOGACION" })).toContain(TEST_LEGEND);
    expect(buildInvoiceTicketHtml(view)).not.toContain(TEST_LEGEND);
  });

  it("la nota de crédito dice qué factura anula", () => {
    const html = buildInvoiceTicketHtml({ ...view, kind: "NOTA_CREDITO_C", relatedNumberLabel: "0001-00000075" });
    expect(html).toContain("NOTA DE CRÉDITO C");
    expect(html).toContain("Cód. 013");
    expect(html).toContain("Anula la factura 0001-00000075");
  });

  it("Consumidor Final sin identificar no muestra nombre ni documento", () => {
    const html = buildInvoiceTicketHtml({ ...view, receiver: { docLabel: null, name: null, ivaLabel: "Consumidor Final" } });
    expect(html).not.toContain("Cliente:");
    expect(html).toContain("IVA: Consumidor Final");
  });

  it("no imprime un comprobante que no está autorizado", () => {
    expect(() => buildInvoiceTicketHtml({ ...view, status: "PENDING", number: null, cae: null })).toThrow();
  });
});
