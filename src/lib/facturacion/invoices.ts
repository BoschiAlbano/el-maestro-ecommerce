import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyTopeFacturacion } from "@/lib/notifications";
import { SecretBoxError } from "@/lib/secret-box";
import { TOPE_WARNING_RATIO, accumulatedLast12Months, capUsagePercent, crossedWarning } from "./accumulated";
import { openArcaSession, withFiscalLock } from "./arca-session";
import { credentialDeps, hasArcaEncryptionKey } from "./credential-repo";
import { CredentialError, getStatus } from "./credential-service";
import type { ReceiverDocType } from "./documentos";
import { dateOnly, oneYearBefore } from "./fechas";
import { missingForInvoicing } from "./fiscal-config";
import { getFiscalConfig, type FiscalConfigView } from "./fiscal-data";
import { authorizeInvoice, type AuthorizeResult } from "./invoice-service";
import { invoiceBlocker, validateReceiver } from "./invoice-policy";
import { prismaInvoiceStore } from "./invoice-store";
import type { InvoiceRequest, SaleInvoiceInfo } from "./invoice-request";
import { isIvaConditionAllowed } from "./iva-conditions";

// La capa de servidor de la facturación (specs/023): crea los comprobantes
// dentro de la transacción de la venta, los autoriza en ARCA después, y avisa
// al cruzar el 80 % del tope. Las reglas están en archivos puros; esto las
// junta con la base y con ARCA.

export type ReceiverInput = {
  docType: ReceiverDocType;
  docNumber?: string | null;
  name?: string | null;
  ivaCondition: number;
};

export type InvoicingAvailability = {
  available: boolean;
  /** Lo que falta, en palabras para el Dueño (RF-4). */
  missing: string[];
  config: FiscalConfigView;
};

export async function loadInvoicingAvailability(): Promise<InvoicingAvailability> {
  const config = await getFiscalConfig();
  const status = await getStatus(credentialDeps(), config.environment);
  const missing = missingForInvoicing({
    config,
    certificate: { loaded: status.hasCertificate, cuit: status.cuit, expiresAt: status.expiresAt },
    hasEncryptionKey: hasArcaEncryptionKey(),
    now: new Date(),
  });
  return { available: missing.length === 0, missing, config };
}

/**
 * ¿Se ofrece "Emitir factura" en el cobro? (RF-4). `null` = no: no está listo
 * para facturar. Si falla la consulta, tampoco se ofrece: el cobro no puede
 * depender de esto.
 */
export async function getInvoicingOffer(): Promise<{ threshold: number } | null> {
  try {
    const availability = await loadInvoicingAvailability();
    return availability.available ? { threshold: availability.config.montoIdentificacion } : null;
  } catch {
    return null;
  }
}

/** Los datos del comprador de una factura, validados antes de vender. Devuelve el error, o `null`. */
export function receiverError(receiver: ReceiverInput, total: number, montoIdentificacion: number): string | null {
  if (!isIvaConditionAllowed(receiver.docType, receiver.ivaCondition)) {
    return receiver.docType === "NONE"
      ? "Sin identificar al comprador, la factura solo puede ser a Consumidor Final."
      : "Elegí la condición frente al IVA del comprador.";
  }
  return validateReceiver(receiver, total, montoIdentificacion);
}

/**
 * Crea el comprobante pendiente DENTRO de la transacción de la venta: la
 * intención de facturar se guarda junto con la venta, todo o nada (constitución,
 * regla 10). Todavía no se llama a ARCA.
 */
export async function createInvoiceInTx(
  tx: Prisma.TransactionClient,
  input: { saleId: string; total: number; receiver: ReceiverInput; userId: string; config: FiscalConfigView },
): Promise<string> {
  const created = await tx.invoice.create({
    data: {
      kind: "FACTURA_C",
      environment: input.config.environment,
      saleId: input.saleId,
      pointOfSale: input.config.puntoDeVenta!,
      total: input.total,
      receiverDocType: input.receiver.docType,
      receiverDocNumber: input.receiver.docType === "NONE" ? null : (input.receiver.docNumber ?? "").replace(/\D/g, ""),
      receiverName: input.receiver.docType === "NONE" ? null : (input.receiver.name ?? "").trim(),
      receiverIvaCondition: input.receiver.ivaCondition,
      requestedByUserId: input.userId,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * La nota de crédito de una factura autorizada, creada dentro de la
 * transacción de la anulación. Copia al comprador y el total de la factura.
 */
export async function createCreditNoteInTx(
  tx: Prisma.TransactionClient,
  input: { invoiceId: string; userId: string },
): Promise<string> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
  const created = await tx.invoice.create({
    data: {
      kind: "NOTA_CREDITO_C",
      environment: invoice.environment,
      origin: invoice.origin,
      saleId: invoice.saleId,
      relatedInvoiceId: invoice.id,
      pointOfSale: invoice.pointOfSale,
      total: invoice.total,
      receiverDocType: invoice.receiverDocType,
      receiverDocNumber: invoice.receiverDocNumber,
      receiverName: invoice.receiverName,
      receiverIvaCondition: invoice.receiverIvaCondition,
      requestedByUserId: input.userId,
    },
    select: { id: true },
  });
  return created.id;
}

function emitterSnapshot(config: FiscalConfigView): Record<string, unknown> {
  return {
    razonSocial: config.razonSocial,
    cuit: config.cuit,
    domicilioComercial: config.domicilioComercial,
    iibb: config.iibb,
    inicioActividades: config.inicioActividades ? dateOnly(config.inicioActividades) : null,
    condicionIva: "Responsable Monotributo",
    pointOfSale: config.puntoDeVenta,
    environment: config.environment,
  };
}

/** Ante un problema de configuración o de clave, el comprobante queda pendiente con el motivo. */
function configFailureReason(error: unknown): string | null {
  if (error instanceof CredentialError) return error.message;
  if (error instanceof SecretBoxError) {
    return "Falta configurar la clave de cifrado de ARCA en el servidor. Avisale a quien administra el sistema.";
  }
  return null;
}

/**
 * Autoriza un comprobante en ARCA (RF-11, RF-12). **Nunca lanza por un
 * problema de ARCA o de configuración**: el comprobante queda pendiente con el
 * motivo y la venta sigue su curso (RF-10). Es seguro llamarla de nuevo.
 */
export async function authorizeInvoiceById(id: string): Promise<AuthorizeResult> {
  let session;
  try {
    session = await openArcaSession();
  } catch (error) {
    const reason = configFailureReason(error);
    if (reason === null) throw error;
    await prismaInvoiceStore.markPending(id, reason);
    return { status: "pending", reason, failure: "invalid" };
  }

  const result = await authorizeInvoice(
    {
      now: () => new Date(),
      emitterCuit: session.cuit,
      gateway: session.gateway,
      store: prismaInvoiceStore,
      ensureTicket: session.ensureTicket,
      withLock: withFiscalLock,
      emitterSnapshot: () => emitterSnapshot(session.config),
    },
    id,
  );

  if (result.status === "authorized" && !result.recovered) await warnIfCapCrossed(id, session.config);

  // La venta se anuló con la factura en el aire y ARCA sí la había autorizado: se anula con una nota de crédito.
  if (result.status === "authorized" && result.needsCreditNote) {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id }, select: { requestedByUserId: true } });
    const creditNoteId = await prisma.$transaction((tx) => createCreditNoteInTx(tx, { invoiceId: id, userId: invoice.requestedByUserId }));
    await authorizeInvoiceById(creditNoteId);
  }
  return result;
}

/** Los comprobantes reales autorizados del último año, para sumar contra el tope. */
async function loadRealAuthorized(now: Date) {
  const authorized = await prisma.invoice.findMany({
    where: {
      status: "AUTHORIZED",
      environment: "PRODUCCION",
      issueDate: { gte: new Date(`${oneYearBefore(now)}T00:00:00.000Z`) },
    },
    select: { id: true, kind: true, status: true, environment: true, total: true, issueDate: true },
  });
  return authorized.map((r) => ({ ...r, total: r.total.toNumber() }));
}

/** Lo facturado en los últimos 12 meses contra el tope cargado (RF-25). Informativo. */
export async function loadAccumulatedSummary(topeAnual: number | null): Promise<{
  accumulated: number;
  cap: number | null;
  percent: number | null;
}> {
  const accumulated = accumulatedLast12Months(await loadRealAuthorized(new Date()), new Date());
  return { accumulated, cap: topeAnual, percent: capUsagePercent(accumulated, topeAnual) };
}

/**
 * Avisa si este comprobante hizo cruzar el 80 % del tope del monotributo
 * (RF-27). Es informativo y de mejor esfuerzo: un error acá nunca afecta a la
 * factura, que ya está autorizada. Los comprobantes de prueba no cuentan.
 */
async function warnIfCapCrossed(invoiceId: string, config: FiscalConfigView): Promise<void> {
  try {
    if (config.environment !== "PRODUCCION" || !config.topeAnual) return;
    const now = new Date();
    const rows = await loadRealAuthorized(now);
    const after = accumulatedLast12Months(rows, now);
    const current = rows.find((r) => r.id === invoiceId);
    if (!current) return;
    const before = after - (current.kind === "FACTURA_C" ? current.total : -current.total);

    if (crossedWarning(before, after, config.topeAnual)) {
      await notifyTopeFacturacion(capUsagePercent(after, config.topeAnual) ?? Math.round(TOPE_WARNING_RATIO * 100), after, config.topeAnual);
    }
  } catch (error) {
    console.error("[facturacion] no se pudo calcular el aviso del tope:", error instanceof Error ? error.name : "error");
  }
}

export type IssueForSaleResult =
  | { error: string }
  | { invoiceId: string; result: AuthorizeResult };

/**
 * Factura una venta ya hecha (RF-15 y RF-16): crea el comprobante y lo
 * autoriza. La factura lleva la fecha de hoy.
 */
export async function issueInvoiceForExistingSale(input: {
  saleId: string;
  receiver: ReceiverInput;
  userId: string;
}): Promise<IssueForSaleResult> {
  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    select: {
      total: true,
      createdAt: true,
      voidedAt: true,
      invoices: { where: { kind: "FACTURA_C", status: { not: "DISCARDED" } }, select: { id: true } },
    },
  });
  if (!sale) return { error: "La venta no existe." };

  const availability = await loadInvoicingAvailability();
  if (!availability.available) return { error: `No se puede facturar: ${availability.missing[0]}` };

  const blocker = invoiceBlocker(
    { createdAt: sale.createdAt, voidedAt: sale.voidedAt, hasActiveInvoice: sale.invoices.length > 0 },
    new Date(),
    availability.config.diasParaFacturar,
  );
  if (blocker) return { error: blocker };

  const total = sale.total.toNumber();
  if (!(total > 0)) return { error: "No se puede facturar una venta por $0: ARCA no acepta comprobantes sin importe." };
  const problem = receiverError(input.receiver, total, availability.config.montoIdentificacion);
  if (problem) return { error: problem };

  let invoiceId: string;
  try {
    invoiceId = await prisma.$transaction((tx) =>
      createInvoiceInTx(tx, { saleId: input.saleId, total, receiver: input.receiver, userId: input.userId, config: availability.config }),
    );
  } catch {
    // Dos pedidos a la vez: la base no deja una segunda factura para la misma venta.
    return { error: "Esta venta ya tiene una factura." };
  }
  return { invoiceId, result: await authorizeInvoiceById(invoiceId) };
}

/** Lo que muestra la pantalla de un comprobante. */
export function describeResult(result: AuthorizeResult): Omit<SaleInvoiceInfo, "id"> {
  if (result.status === "authorized") return { status: "authorized", number: result.number };
  if (result.status === "discarded") return { status: "discarded" };
  return { status: "pending", reason: result.reason };
}

/**
 * Antes de vender: ¿se puede facturar y los datos del comprador están bien?
 * Se valida ANTES de crear la venta para no cobrar algo que después no se
 * puede facturar por un dato mal cargado (RF-4, RF-6).
 */
export async function prepareInvoice(
  request: InvoiceRequest,
  total: number,
): Promise<{ error: string } | { config: FiscalConfigView }> {
  if (!(total > 0)) return { error: "No se puede facturar una venta por $0: ARCA no acepta comprobantes sin importe." };
  const availability = await loadInvoicingAvailability();
  if (!availability.available) return { error: `No se puede facturar: ${availability.missing[0]}` };
  const problem = receiverError(request.receiver, total, availability.config.montoIdentificacion);
  if (problem) return { error: problem };
  return { config: availability.config };
}

/**
 * Autoriza la factura de una venta que ya se confirmó. **Nunca lanza**: la
 * venta ya está hecha y no puede fallar por la factura (RF-10). Ante cualquier
 * problema, el comprobante queda pendiente y se puede reintentar.
 */
export async function authorizeAfterSale(invoiceId: string): Promise<SaleInvoiceInfo> {
  try {
    return { id: invoiceId, ...describeResult(await authorizeInvoiceById(invoiceId)) };
  } catch (error) {
    console.error("[facturacion] error al autorizar tras la venta:", error instanceof Error ? error.name : "error");
    return { id: invoiceId, status: "pending", reason: "No se pudo emitir la factura ahora. Probá de nuevo en un momento." };
  }
}
