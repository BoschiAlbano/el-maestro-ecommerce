import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import type { InvoiceView } from "./invoice-document";
import { LABEL_PAGE_SIZE, renderInvoicePdf } from "./invoice-pdf";

async function mercadoLibreInvoice(): Promise<InvoiceView> {
  return {
    id: "i1",
    kind: "FACTURA_C",
    status: "AUTHORIZED",
    environment: "HOMOLOGACION",
    saleId: "s1",
    ticketNumber: 42,
    pointOfSale: 1,
    number: 91,
    issueDate: "2026-11-20",
    cae: "76458123456789",
    caeExpiresAt: "2026-11-30",
    total: 7300,
    emitter: {
      razonSocial: "Casa de Prueba",
      cuit: "20111111112",
      domicilioComercial: "Calle 123, Tucumán",
      iibb: "123-456",
      inicioActividades: "2020-03-01",
      condicionIva: "Responsable Monotributo",
    },
    receiver: { docLabel: "DNI 11111111", name: "Test Test", ivaLabel: "Consumidor Final", address: "Calle Falsa 123 · Capital, Tucumán · CP 4000" },
    // Un carrito: los dos productos de la orden (specs/024, RF-10).
    items: [
      { description: "Billetera Negra Para Hombre Diseño Clásico", quantity: 1, unitPrice: 2500, subtotal: 2500 },
      { description: "Cable Usb-c A Usb-a Genérico Negro Trenzado 1 Metro", quantity: 2, unitPrice: 2400, subtotal: 4800 },
    ],
    relatedNumberLabel: null,
    qrDataUrl: await QRCode.toDataURL("https://www.arca.gob.ar/fe/qr/?p=e30=", { margin: 0, scale: 6 }),
    lastError: null,
  };
}

describe("factura en PDF (specs/024, RF-17)", () => {
  it("en 10 × 15: una sola página del tamaño de la etiqueta", async () => {
    const pdf = await PDFDocument.load(await renderInvoicePdf(await mercadoLibreInvoice(), "10x15"));
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(LABEL_PAGE_SIZE[0], 0);
    expect(height).toBeCloseTo(LABEL_PAGE_SIZE[1], 0);
  });

  it("en A4 sigue igual (spec 023)", async () => {
    const pdf = await PDFDocument.load(await renderInvoicePdf(await mercadoLibreInvoice()));
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});
