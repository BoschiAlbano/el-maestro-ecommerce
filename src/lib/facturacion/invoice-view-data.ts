import "server-only";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "./fechas";
import { formatCuit, formatInvoiceNumber, type InvoiceView } from "./invoice-document";
import { ivaConditionLabel } from "./iva-conditions";
import { buildQrUrl } from "./qr";

// Arma lo que muestran la ventana del comprobante y el PDF (specs/023, RF-19).

type Snapshot = {
  razonSocial?: string;
  cuit?: string;
  domicilioComercial?: string;
  iibb?: string;
  inicioActividades?: string | null;
  condicionIva?: string;
};

/** El QR como imagen. ~4 puntos por módulo en la térmica de 58 mm: se imprime a 34 mm. */
async function qrImage(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 0, scale: 6 });
}

/** El comprobante listo para mostrar, o `null` si no existe. No hace falta permiso de más que ver ventas. */
export async function loadInvoiceView(invoiceId: string): Promise<InvoiceView | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      relatedInvoice: { select: { pointOfSale: true, number: true } },
      sale: {
        select: {
          ticketNumber: true,
          channel: true,
          items: { include: { product: { select: { name: true } } } },
          // En una venta de Mercado Libre el detalle sale de la orden: un ítem sin vincular no tiene renglón de venta (specs/024).
          mlOrder: { select: { items: { select: { title: true, quantity: true, unitPrice: true }, orderBy: { mlOrderId: "asc" } } } },
        },
      },
    },
  });
  if (!invoice) return null;

  const snapshot = (invoice.emitterSnapshot ?? null) as Snapshot | null;
  const authorized = invoice.status === "AUTHORIZED" && invoice.number !== null && invoice.cae !== null && invoice.issueDate !== null;

  const docDigits = invoice.receiverDocNumber ?? "";
  const docLabel =
    invoice.receiverDocType === "NONE" || !docDigits
      ? null
      : invoice.receiverDocType === "CUIT"
        ? `CUIT ${formatCuit(docDigits)}`
        : `DNI ${docDigits}`;

  const qrUrl =
    authorized && snapshot?.cuit
      ? buildQrUrl({
          kind: invoice.kind,
          emitterCuit: snapshot.cuit,
          pointOfSale: invoice.pointOfSale,
          number: invoice.number!,
          total: invoice.total.toNumber(),
          issueDate: invoice.issueDate!,
          cae: invoice.cae!,
          receiverDocType: invoice.receiverDocType,
          receiverDocNumber: invoice.receiverDocNumber,
        })
      : null;

  return {
    id: invoice.id,
    kind: invoice.kind,
    status: invoice.status,
    environment: invoice.environment,
    saleId: invoice.saleId,
    ticketNumber: invoice.sale.ticketNumber,
    pointOfSale: invoice.pointOfSale,
    number: invoice.number,
    issueDate: invoice.issueDate ? dateOnly(invoice.issueDate) : null,
    cae: invoice.cae,
    caeExpiresAt: invoice.caeExpiresAt ? dateOnly(invoice.caeExpiresAt) : null,
    total: invoice.total.toNumber(),
    emitter: snapshot
      ? {
          razonSocial: snapshot.razonSocial ?? "",
          cuit: snapshot.cuit ?? "",
          domicilioComercial: snapshot.domicilioComercial ?? "",
          iibb: snapshot.iibb ?? "",
          inicioActividades: snapshot.inicioActividades ?? null,
          condicionIva: snapshot.condicionIva ?? "Responsable Monotributo",
        }
      : null,
    receiver: {
      docLabel,
      name: invoice.receiverName,
      ivaLabel: ivaConditionLabel(invoice.receiverIvaCondition),
      address: invoice.receiverAddress,
    },
    items:
      invoice.sale.channel === "MERCADO_LIBRE" && invoice.sale.mlOrder
        ? invoice.sale.mlOrder.items.map((item) => ({
            description: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toNumber(),
            subtotal: item.quantity * item.unitPrice.toNumber(),
          }))
        : invoice.sale.items.map((item) => ({
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitSalePrice.toNumber(),
            subtotal: item.quantity * item.unitSalePrice.toNumber(),
          })),
    relatedNumberLabel:
      invoice.relatedInvoice?.number != null
        ? formatInvoiceNumber(invoice.relatedInvoice.pointOfSale, invoice.relatedInvoice.number)
        : null,
    qrDataUrl: qrUrl ? await qrImage(qrUrl) : null,
    lastError: invoice.lastError,
  };
}
