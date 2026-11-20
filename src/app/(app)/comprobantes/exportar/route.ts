import "server-only";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/current-user";
import { isOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFiscalConfig } from "@/lib/facturacion/fiscal-data";
import { dateOnly } from "@/lib/facturacion/fechas";
import { KIND_TITLE, formatInvoiceNumber, formatIsoDate } from "@/lib/facturacion/invoice-document";
import { invoiceWhere, parseInvoiceFilters } from "@/lib/facturacion/invoice-list";
import { ivaConditionLabel } from "@/lib/facturacion/iva-conditions";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { PENDING: "Pendiente", AUTHORIZED: "Emitido", DISCARDED: "Sin efecto" } as const;

/** Los comprobantes filtrados, a Excel, para el contador (specs/023, RF-24). Solo el Dueño. */
export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isOwner(currentUser)) return new Response("No tenés permiso para esto.", { status: 403 });

  const url = new URL(request.url);
  const filters = parseInvoiceFilters(Object.fromEntries(url.searchParams));
  const config = await getFiscalConfig();
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere(filters, config.environment),
    include: { sale: { select: { ticketNumber: true } }, relatedInvoice: { select: { pointOfSale: true, number: true } } },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Comprobantes");
  sheet.addRow([
    "Fecha",
    "Tipo",
    "Número",
    "Estado",
    "Ambiente",
    "Origen",
    "Comprador",
    "Documento",
    "Condición IVA",
    "Total",
    "CAE",
    "Vto. CAE",
    "Venta (ticket)",
    "Anula la factura",
  ]);
  sheet.getRow(1).font = { bold: true };
  for (const invoice of invoices) {
    // Una nota de crédito resta: en el Excel va en negativo, así la suma de la columna ya es el neto.
    const signed = invoice.kind === "NOTA_CREDITO_C" ? -invoice.total.toNumber() : invoice.total.toNumber();
    sheet.addRow([
      invoice.issueDate ? formatIsoDate(dateOnly(invoice.issueDate)) : "",
      KIND_TITLE[invoice.kind],
      invoice.number !== null ? formatInvoiceNumber(invoice.pointOfSale, invoice.number) : "",
      STATUS_LABEL[invoice.status],
      invoice.environment === "PRODUCCION" ? "Real" : "Prueba",
      invoice.origin === "MERCADO_LIBRE" ? "Mercado Libre" : "Local",
      invoice.receiverName ?? "Consumidor Final",
      invoice.receiverDocNumber ? `${invoice.receiverDocType} ${invoice.receiverDocNumber}` : "",
      ivaConditionLabel(invoice.receiverIvaCondition),
      signed,
      invoice.cae ?? "",
      invoice.caeExpiresAt ? formatIsoDate(dateOnly(invoice.caeExpiresAt)) : "",
      invoice.sale.ticketNumber,
      invoice.relatedInvoice?.number != null
        ? formatInvoiceNumber(invoice.relatedInvoice.pointOfSale, invoice.relatedInvoice.number)
        : "",
    ]);
  }
  sheet.getColumn(10).numFmt = '"$"#,##0.00';
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="comprobantes.xlsx"',
    },
  });
}
