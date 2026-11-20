import "server-only";
import { prisma } from "@/lib/prisma";
import { invoicePdfFileName } from "@/lib/facturacion/invoice-document";
import { renderInvoicePdf } from "@/lib/facturacion/invoice-pdf";
import { loadInvoiceView } from "@/lib/facturacion/invoice-view-data";
import { authorizeInvoiceById, issueInvoiceForExistingSale, loadInvoicingAvailability, type ReceiverInput } from "@/lib/facturacion/invoices";
import { mlErrorMessage } from "../listings";
import { readBillingInfo, type BuyerFiscalData } from "./billing-read";
import { decideReceiver, receiverWasEdited, type ReceiverDecision } from "./invoice-receiver";
import { EXTERNAL_INVOICE_NOTE, orderInvoiceState, prepareAvailability, type OrderInvoiceState } from "./invoice-state";
import { FiscalDocumentExistsError, getBillingInfo, getOrder, listFiscalDocuments, uploadFiscalDocument } from "./orders-api";

// La factura de una orden de Mercado Libre (specs/024, plan sección 3): «Preparar
// envío» emite con la facturación de la spec 023 y sube el PDF a la compra.
// Las decisiones están en archivos puros; esto las junta con la base, ARCA y
// Mercado Libre.

/** Mercado Libre no acepta archivos de más de 1 MB (plan, sección 3.3). */
const MAX_UPLOAD_BYTES = 1024 * 1024;
/** Una subida reclamada hace más que esto se da por perdida (el proceso se cortó) y se puede reclamar de nuevo. */
const UPLOAD_CLAIM_TTL_MS = 2 * 60 * 1000;

const orderSelect = {
  id: true,
  status: true,
  fraudRisk: true,
  cancelledAt: true,
  mlOrderIds: true,
  mlPackId: true,
  saleId: true,
  total: true,
  needsReview: true,
  invoiceUploadedAt: true,
  invoiceUploadError: true,
  mlFiscalDocumentId: true,
  sale: {
    select: {
      invoices: {
        where: { kind: "FACTURA_C", status: { not: "DISCARDED" } },
        select: { id: true, status: true, lastError: true, _count: { select: { creditNotes: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  },
} as const;

async function loadOrder(orderId: string) {
  return prisma.mercadoLibreOrder.findUnique({ where: { id: orderId }, select: orderSelect });
}
type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

/** La compra en Mercado Libre: el paquete, o la orden cuando no hay paquete (prueba técnica). */
function purchaseId(order: Pick<LoadedOrder, "mlPackId" | "mlOrderIds">): string {
  return order.mlPackId ?? order.mlOrderIds[0];
}

function hasExternalNote(needsReview: string | null): boolean {
  return (needsReview ?? "").includes(EXTERNAL_INVOICE_NOTE);
}

export function invoiceStateOf(order: Pick<LoadedOrder, "sale" | "invoiceUploadedAt" | "needsReview">): OrderInvoiceState {
  const invoice = order.sale?.invoices[0] ?? null;
  return orderInvoiceState({
    invoice: invoice && invoice.status !== "DISCARDED" ? { status: invoice.status, hasCreditNote: invoice._count.creditNotes > 0 } : null,
    uploadedAt: order.invoiceUploadedAt,
    externalInvoice: hasExternalNote(order.needsReview),
  });
}

/** Deja anotado en la orden que la compra ya tenía una factura que no subió el sistema (regla de transición). */
async function markExternalInvoice(order: Pick<LoadedOrder, "id" | "needsReview">): Promise<void> {
  if (hasExternalNote(order.needsReview)) return;
  const needsReview = order.needsReview ? `${order.needsReview} ${EXTERNAL_INVOICE_NOTE}` : EXTERNAL_INVOICE_NOTE;
  await prisma.mercadoLibreOrder.update({ where: { id: order.id }, data: { needsReview } });
}

// ---------------------------------------------------------------------------
// Al abrir «Preparar envío»
// ---------------------------------------------------------------------------

export type InvoiceDraft =
  | { kind: "blocked"; reason: string }
  /** La venta ya tiene su factura: se muestra esa y sus impresiones, no se emite otra. */
  | { kind: "existing"; invoiceId: string; state: OrderInvoiceState; uploadError: string | null; invoiceError: string | null }
  | {
      kind: "draft";
      decision: ReceiverDecision;
      total: number;
      /** Monto desde el que la factura tiene que identificar al comprador (spec 023). */
      threshold: number;
      /** No se pudieron leer los datos fiscales de Mercado Libre: se cargan a mano. */
      billingError: string | null;
    };

/**
 * Lo que muestra la ventana de «Preparar envío» (RF-2 a RF-7). Consulta
 * Mercado Libre: los archivos ya cargados en la compra y los datos fiscales
 * vigentes del comprador.
 */
export async function loadInvoiceDraft(orderId: string): Promise<InvoiceDraft> {
  const order = await loadOrder(orderId);
  if (!order) return { kind: "blocked", reason: "La orden no existe." };
  if (!order.saleId || !order.sale) return { kind: "blocked", reason: "La compra no tiene una venta registrada en el sistema." };

  const availability = await loadInvoicingAvailability();
  const state = invoiceStateOf(order);
  const allowed = prepareAvailability({
    status: order.status,
    fraudRisk: order.fraudRisk,
    invoiceState: state,
    emitterMissing: availability.missing[0] ?? null,
  });
  if (!allowed.available) return { kind: "blocked", reason: allowed.reason };

  const invoice = order.sale.invoices[0];
  if (invoice) {
    return { kind: "existing", invoiceId: invoice.id, state, uploadError: order.invoiceUploadError, invoiceError: invoice.lastError };
  }

  const external = await externalInvoiceCheck(order);
  if (external) return { kind: "blocked", reason: external };

  const total = order.total.toNumber();
  const threshold = availability.config.montoIdentificacion;
  let fiscal: BuyerFiscalData | null = null;
  let billingError: string | null = null;
  try {
    fiscal = await readBuyerFiscalData(order.mlOrderIds[0]);
  } catch (error) {
    billingError = `No se pudieron leer los datos de facturación de Mercado Libre: ${mlErrorMessage(error)}`;
  }
  return { kind: "draft", decision: decideReceiver(fiscal, total, threshold), total, threshold, billingError };
}

/** Los datos fiscales vigentes del comprador (spec, sección 7: los del momento de preparar). `null` si no informó. */
async function readBuyerFiscalData(mlOrderId: string): Promise<BuyerFiscalData | null> {
  const mlOrder = await getOrder(mlOrderId);
  const billingInfoId = mlOrder.buyer.billing_info?.id;
  if (!billingInfoId) return null;
  const info = await getBillingInfo(billingInfoId);
  return info ? readBillingInfo(info) : null;
}

/**
 * Si la compra ya tiene una factura cargada en Mercado Libre (por ejemplo, del
 * Facturador), no se emite otra: sería facturar dos veces en ARCA. Devuelve el
 * motivo, o `null` si no hay ninguna.
 */
async function externalInvoiceCheck(order: LoadedOrder): Promise<string | null> {
  let documents;
  try {
    documents = await listFiscalDocuments(purchaseId(order));
  } catch (error) {
    return `No se pudo revisar si la compra ya tiene factura en Mercado Libre: ${mlErrorMessage(error)} Probá de nuevo en un momento.`;
  }
  if (documents.length === 0) return null;
  await markExternalInvoice(order);
  return "La compra ya tiene una factura cargada en Mercado Libre: el sistema no la factura otra vez.";
}

// ---------------------------------------------------------------------------
// Al confirmar
// ---------------------------------------------------------------------------

export type PrepareResult =
  | { error: string }
  | {
      invoiceId: string;
      state: OrderInvoiceState;
      /** Motivo de la factura pendiente de ARCA o de la subida fallida, para mostrar. */
      message: string | null;
    };

/**
 * «Preparar envío» (RF-1 a RF-12): emite la factura con los datos confirmados
 * y la sube a Mercado Libre. Si la venta ya tenía factura no emite otra.
 * Quien llama valida el permiso.
 */
export async function prepareShipment(input: {
  orderId: string;
  receiver: ReceiverInput;
  userId: string;
}): Promise<PrepareResult> {
  const order = await loadOrder(input.orderId);
  if (!order) return { error: "La orden no existe." };
  if (!order.saleId || !order.sale) return { error: "La compra no tiene una venta registrada en el sistema." };

  const availability = await loadInvoicingAvailability();
  const allowed = prepareAvailability({
    status: order.status,
    fraudRisk: order.fraudRisk,
    invoiceState: invoiceStateOf(order),
    emitterMissing: availability.missing[0] ?? null,
  });
  if (!allowed.available) return { error: allowed.reason };

  // Preparar dos veces: no se emite otra; si faltaba subirla, se intenta.
  const existing = order.sale.invoices[0];
  if (existing) {
    if (existing.status === "AUTHORIZED" && !order.invoiceUploadedAt) await uploadOrderInvoice(order.id);
    await markPrepared(order.id, input.userId);
    return describeOrderInvoice(order.id);
  }

  const external = await externalInvoiceCheck(order);
  if (external) return { error: external };

  // Se compara con lo que propone Mercado Libre ahora, no con lo que mandó el navegador (RF-8).
  let proposed: BuyerFiscalData | null = null;
  try {
    proposed = await readBuyerFiscalData(order.mlOrderIds[0]);
  } catch {
    proposed = null;
  }
  const decision = decideReceiver(proposed, order.total.toNumber(), availability.config.montoIdentificacion);
  const receiverEdited = receiverWasEdited(decision.receiver, {
    docType: input.receiver.docType,
    docNumber: input.receiver.docNumber ?? null,
    name: input.receiver.name ?? null,
    ivaCondition: input.receiver.ivaCondition,
    address: input.receiver.address ?? null,
  });

  const issued = await issueInvoiceForExistingSale({
    saleId: order.saleId,
    receiver: input.receiver,
    userId: input.userId,
    origin: "MERCADO_LIBRE",
    receiverEdited,
  });
  if ("error" in issued) return { error: issued.error };

  // Autorizada: `authorizeInvoiceById` ya intentó subirla (`uploadInvoiceOfSale`).
  await markPrepared(order.id, input.userId);
  return describeOrderInvoice(order.id);
}

async function markPrepared(orderId: string, userId: string): Promise<void> {
  await prisma.mercadoLibreOrder.updateMany({
    where: { id: orderId, preparedAt: null },
    data: { preparedAt: new Date(), preparedByUserId: userId },
  });
}

/** El estado de la factura de la orden después de preparar o reintentar, para mostrar. */
async function describeOrderInvoice(orderId: string): Promise<PrepareResult> {
  const order = await loadOrder(orderId);
  const invoice = order?.sale?.invoices[0];
  if (!order || !invoice) return { error: "No se encontró la factura de la orden." };
  const state = invoiceStateOf(order);
  const message =
    state === "pending"
      ? (invoice.lastError ?? "La factura quedó pendiente de autorización en ARCA.")
      : state === "not_uploaded"
        ? (order.invoiceUploadError ?? "La factura todavía no se subió a Mercado Libre.")
        : null;
  return { invoiceId: invoice.id, state, message };
}

// ---------------------------------------------------------------------------
// Subida a Mercado Libre
// ---------------------------------------------------------------------------

export type UploadResult =
  | { status: "uploaded" }
  /** La factura todavía no está autorizada: no hay nada para subir. */
  | { status: "not_ready" }
  /** Otra subida de la misma orden está en curso. */
  | { status: "busy" }
  | { status: "failed"; error: string };

/**
 * Sube la factura autorizada de la orden a la compra en Mercado Libre (RF-13,
 * RF-14). La subida se reclama con una actualización condicional: dos clics o
 * dos procesos no la suben dos veces. Nunca lanza: un error queda guardado en
 * la orden para reintentar.
 */
export async function uploadOrderInvoice(orderId: string): Promise<UploadResult> {
  const order = await loadOrder(orderId);
  if (!order) return { status: "failed", error: "La orden no existe." };
  if (order.invoiceUploadedAt) return { status: "uploaded" };
  const invoice = order.sale?.invoices[0];
  if (!invoice || invoice.status !== "AUTHORIZED") return { status: "not_ready" };
  // Cancelada: la factura ya tiene (o va a tener) su nota de crédito; no se sube (RF-19).
  if (order.cancelledAt) return { status: "not_ready" };

  const now = new Date();
  const claim = await prisma.mercadoLibreOrder.updateMany({
    where: {
      id: order.id,
      invoiceUploadedAt: null,
      OR: [{ invoiceUploadingAt: null }, { invoiceUploadingAt: { lt: new Date(now.getTime() - UPLOAD_CLAIM_TTL_MS) } }],
    },
    data: { invoiceUploadingAt: now },
  });
  if (claim.count === 0) return { status: "busy" };

  try {
    const view = await loadInvoiceView(invoice.id);
    if (!view || view.status !== "AUTHORIZED" || view.number === null) return await failUpload(order.id, "La factura todavía no está emitida.");
    const fileName = invoicePdfFileName(view);
    const packId = purchaseId(order);

    // Si ya hay un archivo en la compra, no se sube otro: Mercado Libre admite uno solo (prueba técnica).
    const already = await ownDocumentOrExternal(packId, order.mlFiscalDocumentId, fileName);
    if (already === "external") {
      return await failUpload(
        order.id,
        "La compra ya tenía una factura cargada en Mercado Libre: no se subió la del sistema. Revisá que no se haya facturado dos veces.",
      );
    }
    if (already) return await markUploaded(order.id, already.id);

    const pdf = await renderInvoicePdf(view);
    if (pdf.byteLength > MAX_UPLOAD_BYTES) return await failUpload(order.id, "El PDF de la factura pesa más de 1 MB: Mercado Libre no lo acepta.");

    let documentId: string;
    try {
      documentId = await uploadFiscalDocument(packId, pdf, fileName);
    } catch (error) {
      if (!(error instanceof FiscalDocumentExistsError)) throw error;
      // Entró otro archivo entre la consulta y la subida: se mira de quién es.
      const found = await ownDocumentOrExternal(packId, order.mlFiscalDocumentId, fileName);
      if (found && found !== "external") return await markUploaded(order.id, found.id);
      return await failUpload(order.id, "La compra ya tenía una factura cargada en Mercado Libre: no se subió la del sistema.");
    }
    return await markUploaded(order.id, documentId);
  } catch (error) {
    return await failUpload(order.id, `No se pudo subir la factura a Mercado Libre: ${mlErrorMessage(error)}`);
  }
}

/**
 * El archivo que ya está en la compra: el que subió el sistema (mismo id o
 * mismo nombre, por si se cortó antes de guardar el id), otro (`"external"`),
 * o `null` si no hay ninguno.
 */
async function ownDocumentOrExternal(
  packId: string,
  knownId: string | null,
  fileName: string,
): Promise<{ id: string } | "external" | null> {
  const documents = await listFiscalDocuments(packId);
  if (documents.length === 0) return null;
  const own = documents.find((d) => (knownId && d.id === knownId) || d.filename === fileName);
  return own ? { id: own.id } : "external";
}

async function markUploaded(orderId: string, documentId: string): Promise<UploadResult> {
  await prisma.mercadoLibreOrder.update({
    where: { id: orderId },
    data: { invoiceUploadedAt: new Date(), mlFiscalDocumentId: documentId || null, invoiceUploadError: null, invoiceUploadingAt: null },
  });
  return { status: "uploaded" };
}

async function failUpload(orderId: string, error: string): Promise<UploadResult> {
  await prisma.mercadoLibreOrder.update({ where: { id: orderId }, data: { invoiceUploadError: error, invoiceUploadingAt: null } });
  return { status: "failed", error };
}

/**
 * Sube la factura de una venta de Mercado Libre apenas se autoriza (también
 * cuando una pendiente se autoriza después, con el reintento de la spec 023).
 * La llama `authorizeInvoiceById`. Nunca lanza.
 */
export async function uploadInvoiceOfSale(saleId: string): Promise<void> {
  try {
    const order = await prisma.mercadoLibreOrder.findUnique({ where: { saleId }, select: { id: true } });
    if (order) await uploadOrderInvoice(order.id);
  } catch (error) {
    console.error("[mercadolibre] no se pudo subir la factura de la orden:", error instanceof Error ? error.name : "error");
  }
}

/**
 * «Reintentar» en la orden (RF-12, RF-14): autoriza la factura pendiente (y
 * con eso la sube) o reintenta solo la subida. Quien llama valida el permiso.
 */
export async function retryOrderInvoice(orderId: string): Promise<PrepareResult> {
  const order = await loadOrder(orderId);
  const invoice = order?.sale?.invoices[0];
  if (!order || !invoice) return { error: "La orden no tiene factura." };
  if (invoice.status === "PENDING") {
    await authorizeInvoiceById(invoice.id);
  } else if (!order.invoiceUploadedAt) {
    await uploadOrderInvoice(order.id);
  }
  return describeOrderInvoice(order.id);
}

/**
 * Pasada diaria (spec 019): sube las facturas autorizadas que quedaron sin
 * subir. Las órdenes canceladas no: su factura ya tiene nota de crédito.
 */
export async function uploadPendingOrderInvoices(limit = 20): Promise<{ tried: number; uploaded: number }> {
  const pending = await prisma.mercadoLibreOrder.findMany({
    where: {
      invoiceUploadedAt: null,
      status: { not: "CANCELLED" },
      sale: { invoices: { some: { kind: "FACTURA_C", status: "AUTHORIZED", origin: "MERCADO_LIBRE" } } },
    },
    select: { id: true },
    orderBy: { mlCreatedAt: "asc" },
    take: limit,
  });
  let uploaded = 0;
  for (const order of pending) {
    if ((await uploadOrderInvoice(order.id)).status === "uploaded") uploaded++;
  }
  return { tried: pending.length, uploaded };
}
