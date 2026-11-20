import { validateReceiverDocument, type ReceiverDocType } from "./documentos";
import { fiscalDaysBetween } from "./fechas";

// Reglas de la facturación (specs/023): cuándo una venta se puede facturar,
// cuándo hay que identificar al comprador y qué pasa con la factura al anular
// la venta. Funciones puras.

/** Código de ARCA para "Consumidor Final". Se confirma en la prueba técnica (A-5). */
export const IVA_CONSUMIDOR_FINAL = 5;

/** ¿El total obliga a identificar al comprador? (RF-9). El monto justo ya obliga. */
export function requiresIdentification(total: number, threshold: number): boolean {
  return threshold > 0 && total >= threshold;
}

export type ReceiverInput = {
  docType: ReceiverDocType;
  docNumber?: string | null;
  name?: string | null;
};

/** Devuelve el mensaje de error, o `null` si los datos del comprador sirven para facturar. */
export function validateReceiver(receiver: ReceiverInput, total: number, threshold: number): string | null {
  if (receiver.docType === "NONE") {
    if (requiresIdentification(total, threshold)) {
      return "Por el monto de la venta, la factura tiene que llevar el nombre y el documento del comprador.";
    }
    return validateReceiverDocument("NONE", receiver.docNumber);
  }

  const documentError = validateReceiverDocument(receiver.docType, receiver.docNumber);
  if (documentError) return documentError;
  if (!receiver.name?.trim()) return "Ingresá el nombre o la razón social del comprador.";
  return null;
}

export type SaleForInvoicing = {
  createdAt: Date;
  voidedAt: Date | null;
  /** Ya tiene una factura pendiente o autorizada (RF-14). */
  hasActiveInvoice: boolean;
};

/**
 * Por qué no se puede facturar esta venta, o `null` si se puede (RF-15 y
 * RF-16). El plazo se cuenta en días de calendario de Tucumán: una venta de
 * anoche a última hora es "de ayer", no "de hace unas horas".
 */
export function invoiceBlocker(sale: SaleForInvoicing, now: Date, diasParaFacturar: number): string | null {
  if (sale.voidedAt) return "No se puede facturar una venta anulada.";
  if (sale.hasActiveInvoice) return "Esta venta ya tiene una factura.";
  if (fiscalDaysBetween(sale.createdAt, now) > diasParaFacturar) {
    return diasParaFacturar === 0
      ? "Solo se puede facturar una venta el mismo día en que se hizo."
      : `Solo se puede facturar una venta hasta ${diasParaFacturar} días después de hecha.`;
  }
  return null;
}

export type VoidDecision =
  /** La factura existe en ARCA: hay que emitir la nota de crédito (RF-17). */
  | "credit_note"
  /**
   * La factura está pendiente: antes de descartarla hay que comprobar en ARCA
   * si un intento anterior llegó a autorizarse (plan, sección 3.4).
   */
  | "verify_then_decide"
  | "nothing";

/** Qué hacer con la factura de una venta que se anula. */
export function decideOnVoid(invoice: { status: "PENDING" | "AUTHORIZED" | "DISCARDED" } | null): VoidDecision {
  if (!invoice) return "nothing";
  if (invoice.status === "AUTHORIZED") return "credit_note";
  if (invoice.status === "PENDING") return "verify_then_decide";
  return "nothing";
}
