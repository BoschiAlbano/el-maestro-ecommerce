// Estado de la factura de una orden de Mercado Libre y si se puede preparar el
// envío (specs/024, RF-2 y RF-15). Puro.
import type { MlOrderStatus } from "@/generated/prisma/enums";
import { NOT_YET_SHIPPED } from "./order-status";

export type OrderInvoiceState = "none" | "pending" | "not_uploaded" | "uploaded" | "external" | "voided";

export const INVOICE_STATE_LABELS: Record<OrderInvoiceState, string> = {
  none: "Sin factura",
  pending: "Pendiente de autorización",
  not_uploaded: "Emitida, sin subir",
  uploaded: "Emitida y subida",
  external: "Ya tenía factura en Mercado Libre",
  voided: "Anulada con nota de crédito",
};

export type OrderInvoiceInput = {
  /** La factura vigente de la venta (pendiente o autorizada); `null` si no hay o se descartó. */
  invoice: { status: "PENDING" | "AUTHORIZED"; hasCreditNote?: boolean } | null;
  uploadedAt: Date | null;
  /** La compra ya tenía una factura cargada en Mercado Libre que no subió el sistema. */
  externalInvoice: boolean;
};

export function orderInvoiceState(input: OrderInvoiceInput): OrderInvoiceState {
  if (!input.invoice) return input.externalInvoice ? "external" : "none";
  // Una compra cancelada después de facturar (RF-20): la factura queda anulada, subida o no.
  if (input.invoice.hasCreditNote) return "voided";
  if (input.invoice.status === "PENDING") return "pending";
  return input.uploadedAt ? "uploaded" : "not_uploaded";
}

export type PrepareAvailability = { available: true } | { available: false; reason: string };

/**
 * Si se puede usar «Preparar envío» (RF-2). Con una factura ya emitida, el
 * botón sigue disponible: muestra esa factura y las impresiones, no emite otra
 * (spec, sección 7).
 */
export function prepareAvailability(input: {
  status: MlOrderStatus;
  fraudRisk: boolean;
  invoiceState: OrderInvoiceState;
  /** Lo que le falta al emisor para facturar (spec 023); `null` si está todo. */
  emitterMissing: string | null;
}): PrepareAvailability {
  if (input.fraudRisk) return { available: false, reason: "Mercado Libre marcó la compra con riesgo de fraude: no la despaches." };
  if (input.status === "CANCELLED") return { available: false, reason: "La compra está cancelada." };
  if (!NOT_YET_SHIPPED.includes(input.status)) return { available: false, reason: "La compra ya salió del local." };
  if (input.invoiceState === "external") {
    return { available: false, reason: "La compra ya tiene una factura cargada en Mercado Libre: el sistema no la factura otra vez." };
  }
  if (input.invoiceState === "none" && input.emitterMissing) {
    return { available: false, reason: `Para facturar falta: ${input.emitterMissing}` };
  }
  return { available: true };
}

/** Mensaje de «la compra ya tenía factura», guardado en la orden para revisarla. */
export const EXTERNAL_INVOICE_NOTE =
  "La compra ya tenía una factura cargada en Mercado Libre (de otro medio): el sistema no la facturó.";
