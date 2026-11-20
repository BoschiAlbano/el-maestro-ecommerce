import { onlyDigits, type ReceiverDocType } from "./documentos";
import { fiscalDate } from "./fechas";
import { parseArcaDate, type ArcaIssue } from "./arca-result";
import { ArcaError, type ArcaFailureKind, type ArcaGateway, type ExistingVoucher } from "./gateway";
import { DOC_TYPE_CODE, VOUCHER_TYPE, VoucherInputError, buildVoucherRequest } from "./voucher";

// Autorizar un comprobante en ARCA sin duplicarlo (specs/023, RF-11 a RF-13 y
// plan sección 3.3). La base, ARCA y el bloqueo entran por `deps`: la lógica
// se prueba entera sin base ni red.
//
// Tres ideas, todas aprendidas de cómo se comporta ARCA:
//   1. De a un comprobante por vez: los números son correlativos.
//   2. Un rechazo no es una excepción (ARCA responde con éxito y `Resultado: "R"`).
//   3. Si no se sabe si el intento anterior llegó a autorizarse (se cortó la
//      respuesta), se pregunta antes de volver a emitir. Para eso el número se
//      guarda ANTES de llamar a ARCA.

export type InvoiceRecord = {
  id: string;
  kind: "FACTURA_C" | "NOTA_CREDITO_C";
  status: "PENDING" | "AUTHORIZED" | "DISCARDED";
  environment: "HOMOLOGACION" | "PRODUCCION";
  pointOfSale: number;
  number: number | null;
  attemptedNumber: number | null;
  total: number;
  receiverDocType: ReceiverDocType;
  receiverDocNumber: string | null;
  receiverIvaCondition: number;
  /** La venta se anuló: una factura pendiente ya no debe emitirse (plan, sección 3.4). */
  saleVoided: boolean;
  /** En una nota de crédito: la factura que deja sin efecto. */
  relatedInvoice: { status: InvoiceRecord["status"]; number: number | null; pointOfSale: number; issueDate: Date | null } | null;
};

export type AuthorizedData = {
  number: number;
  cae: string;
  caeExpiresAt: Date;
  issueDate: Date;
  emitterSnapshot: Record<string, unknown>;
  authorizedAt: Date;
};

export interface InvoiceStore {
  load(id: string): Promise<InvoiceRecord | null>;
  /** Se confirma ANTES de llamar a ARCA: tiene que sobrevivir a una caída en el medio. */
  saveAttempt(id: string, attemptedNumber: number): Promise<void>;
  markAuthorized(id: string, data: AuthorizedData): Promise<void>;
  /** Suma un intento y guarda el motivo. */
  markPending(id: string, reason: string): Promise<void>;
  /** Deja el comprobante sin efecto: nunca llegó a existir en ARCA. */
  discard(id: string, reason: string): Promise<void>;
  /** ¿Otro comprobante nuestro, autorizado, ya tiene ese número? Entonces no es el que se estaba buscando. */
  isNumberTakenByAnother(invoice: InvoiceRecord, number: number): Promise<boolean>;
}

export type AuthorizeDeps = {
  now(): Date;
  emitterCuit: string;
  gateway: Pick<ArcaGateway, "lastNumber" | "findVoucher" | "emit">;
  store: InvoiceStore;
  /** Garantiza el permiso de ARCA (con su propio bloqueo). Se llama antes del bloqueo de emisión. */
  ensureTicket(): Promise<unknown>;
  /** Ejecuta `fn` de a un proceso por vez (en la base, `SELECT … FOR UPDATE`). */
  withLock<T>(fn: () => Promise<T>): Promise<T>;
  emitterSnapshot(): Record<string, unknown>;
};

export type AuthorizeResult =
  | {
      status: "authorized";
      number: number;
      cae: string;
      /** Se recuperó un comprobante que ARCA ya había autorizado. */
      recovered: boolean;
      /** La venta estaba anulada: hay que emitir la nota de crédito de esta factura. */
      needsCreditNote?: boolean;
    }
  /** La venta se anuló y ARCA no tenía la factura: se descartó, no hace falta nota de crédito. */
  | { status: "discarded" }
  | {
      status: "pending";
      reason: string;
      /** `rejected` = ARCA lo rechazó; el resto, por qué no se pudo hablar con ARCA. */
      failure: "rejected" | "invalid" | ArcaFailureKind;
      issues?: ArcaIssue[];
    };

const VOUCHER_TYPE_OF = { FACTURA_C: VOUCHER_TYPE.FACTURA_C, NOTA_CREDITO_C: VOUCHER_TYPE.NOTA_CREDITO_C } as const;

/** ¿El comprobante que ARCA tiene con ese número es este? Se compara lo que ARCA devuelve para consultar. */
export function voucherMatches(invoice: InvoiceRecord, existing: ExistingVoucher): boolean {
  if (!existing.authorized || !/^\d{14}$/.test(existing.cae)) return false;
  if (Math.abs(existing.total - invoice.total) > 0.005) return false;
  if (existing.docType !== DOC_TYPE_CODE[invoice.receiverDocType]) return false;
  const expectedDoc = invoice.receiverDocType === "NONE" ? 0 : Number(onlyDigits(invoice.receiverDocNumber ?? ""));
  return existing.docNumber === expectedDoc;
}

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

function fiscalDateAsUtcDate(date: Date): Date {
  return new Date(`${fiscalDate(date)}T00:00:00.000Z`);
}

async function pending(
  deps: AuthorizeDeps,
  id: string,
  reason: string,
  failure: Extract<AuthorizeResult, { status: "pending" }>["failure"],
  issues?: ArcaIssue[],
): Promise<AuthorizeResult> {
  await deps.store.markPending(id, reason);
  return { status: "pending", reason, failure, issues };
}

/**
 * Autoriza un comprobante. Nunca lanza por un rechazo ni por una caída de
 * ARCA: devuelve `pending` con el motivo, y la venta sigue su curso (RF-10).
 * Es seguro llamarla de nuevo sobre el mismo comprobante.
 */
export async function authorizeInvoice(deps: AuthorizeDeps, id: string): Promise<AuthorizeResult> {
  // El permiso va antes del bloqueo de emisión: no se anidan dos bloqueos sobre la misma fila.
  try {
    await deps.ensureTicket();
  } catch (error) {
    if (error instanceof ArcaError) return pending(deps, id, error.message, error.failure);
    throw error;
  }
  return deps.withLock(() => authorizeLocked(deps, id));
}

async function authorizeLocked(deps: AuthorizeDeps, id: string): Promise<AuthorizeResult> {
  const invoice = await deps.store.load(id);
  if (!invoice) throw new Error("El comprobante no existe.");
  if (invoice.status === "DISCARDED") throw new Error("El comprobante fue descartado: ya no se puede autorizar.");
  if (invoice.status === "AUTHORIZED") {
    return { status: "authorized", number: invoice.number ?? 0, cae: "", recovered: false };
  }

  const type = VOUCHER_TYPE_OF[invoice.kind];

  // Una factura pendiente de una venta anulada no se emite: se averigua si ARCA ya la
  // tenía (se cortó la respuesta justo antes de anular) y, según eso, se anula con una
  // nota de crédito o se descarta.
  if (invoice.kind === "FACTURA_C" && invoice.saleVoided) {
    try {
      if (invoice.attemptedNumber !== null) {
        const recovered = await recover(deps, invoice, type);
        if (recovered?.status === "authorized") return { ...recovered, needsCreditNote: true };
      }
    } catch (error) {
      // Sin poder preguntarle a ARCA no se descarta: podría estar autorizada.
      if (error instanceof ArcaError) return pending(deps, id, error.message, error.failure);
      throw error;
    }
    await deps.store.discard(id, "La venta se anuló antes de que se autorizara la factura.");
    return { status: "discarded" };
  }

  if (invoice.kind === "NOTA_CREDITO_C") {
    const related = invoice.relatedInvoice;
    if (!related || related.status !== "AUTHORIZED" || related.number === null || related.issueDate === null) {
      return pending(deps, id, "La factura que se quiere anular todavía no está autorizada.", "invalid");
    }
  }

  try {
    // 1. ¿El intento anterior llegó a autorizarse? (se cortó la respuesta, se cayó el servidor…)
    if (invoice.attemptedNumber !== null) {
      const recovered = await recover(deps, invoice, type);
      if (recovered) return recovered;
    }

    // 2. Emitir. Si ARCA dice que el número no es el próximo (otro emitió en el medio),
    //    se vuelve a consultar el último y se reintenta una sola vez.
    for (let round = 0; round < 2; round++) {
      const number = (await deps.gateway.lastNumber(invoice.pointOfSale, type)) + 1;
      await deps.store.saveAttempt(id, number);

      const now = deps.now();
      const outcome = await deps.gateway.emit(
        buildVoucherRequest({
          kind: invoice.kind,
          emitterCuit: deps.emitterCuit,
          pointOfSale: invoice.pointOfSale,
          number,
          total: invoice.total,
          issueDate: now,
          receiver: {
            docType: invoice.receiverDocType,
            docNumber: invoice.receiverDocNumber,
            ivaCondition: invoice.receiverIvaCondition,
          },
          associatedInvoice:
            invoice.kind === "NOTA_CREDITO_C"
              ? {
                  pointOfSale: invoice.relatedInvoice!.pointOfSale,
                  number: invoice.relatedInvoice!.number!,
                  issueDate: invoice.relatedInvoice!.issueDate!,
                }
              : undefined,
        }),
      );

      if (outcome.status === "authorized") {
        await deps.store.markAuthorized(id, {
          number: outcome.number,
          cae: outcome.cae,
          caeExpiresAt: outcome.caeExpiresAt,
          issueDate: fiscalDateAsUtcDate(now),
          emitterSnapshot: deps.emitterSnapshot(),
          authorizedAt: now,
        });
        return { status: "authorized", number: outcome.number, cae: outcome.cae, recovered: false };
      }

      const numbering = outcome.issues.some((issue) => issue.kind === "numbering");
      if (numbering && round === 0) continue;
      return pending(deps, id, outcome.issues.map((issue) => issue.message).join(" "), "rejected", outcome.issues);
    }
    return pending(deps, id, "ARCA no aceptó el número del comprobante. Probá de nuevo.", "rejected");
  } catch (error) {
    if (error instanceof ArcaError) return pending(deps, id, error.message, error.failure);
    // Los datos del comprobante no sirven (por ejemplo, total en cero): no hay nada que ARCA pueda
    // hacer con ellos, y el motivo exacto es lo que hay que mostrar, no un «error inesperado».
    if (error instanceof VoucherInputError) return pending(deps, id, error.message, "invalid");
    // Algo nuestro, no de ARCA: se deja constancia y el error sube.
    await deps.store.markPending(id, "Error inesperado al autorizar el comprobante.");
    throw error;
  }
}

/** Si ARCA ya tiene el comprobante del intento anterior, lo da por autorizado sin emitir otro. */
async function recover(deps: AuthorizeDeps, invoice: InvoiceRecord, type: number): Promise<AuthorizeResult | null> {
  const attempted = invoice.attemptedNumber!;
  const existing = await deps.gateway.findVoucher(invoice.pointOfSale, type, attempted);
  if (!existing || !voucherMatches(invoice, existing)) return null;
  // Con ese número hay un comprobante nuestro distinto: el de ARCA es de él.
  if (await deps.store.isNumberTakenByAnother(invoice, attempted)) return null;

  const issueDate = parseArcaDate(existing.issueDate);
  if (!issueDate) return null;
  const caeExpiresAt = parseArcaDate(existing.caeExpiresAt) ?? new Date(issueDate.getTime() + TEN_DAYS_MS);

  await deps.store.markAuthorized(invoice.id, {
    number: attempted,
    cae: existing.cae,
    caeExpiresAt,
    issueDate,
    emitterSnapshot: deps.emitterSnapshot(),
    authorizedAt: deps.now(),
  });
  return { status: "authorized", number: attempted, cae: existing.cae, recovered: true };
}
