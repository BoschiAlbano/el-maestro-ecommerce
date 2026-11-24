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

/**
 * `prepare`: «Preparar envío», la orden todavía no salió (RF-1).
 * `invoice`: «Facturar», la orden ya salió o se entregó sin factura (RF-1b).
 */
export type InvoiceMode = "prepare" | "invoice";

export type PrepareAvailability = { available: true; mode: InvoiceMode } | { available: false; reason: string };

/** Ya salió del local y llegó o está en camino: todavía se puede facturar (RF-1b). */
const SHIPPED_OUT: MlOrderStatus[] = ["SHIPPED", "DELIVERED"];

/**
 * Si se puede usar «Preparar envío» (RF-2) o, en una orden que ya salió,
 * «Facturar» (RF-1b y RF-2b). Con una factura ya emitida sigue disponible:
 * muestra esa factura y las impresiones, no emite otra (spec, sección 7).
 * El plazo para facturar lo revisa quien llama (spec 023).
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
  if (input.status === "NOT_DELIVERED") return { available: false, reason: "La compra no se entregó." };
  const mode: InvoiceMode | null = NOT_YET_SHIPPED.includes(input.status) ? "prepare" : SHIPPED_OUT.includes(input.status) ? "invoice" : null;
  if (!mode) return { available: false, reason: "La compra no se puede facturar en este estado." };
  if (input.invoiceState === "external") {
    return { available: false, reason: "La compra ya tiene una factura cargada en Mercado Libre: el sistema no la factura otra vez." };
  }
  if (input.invoiceState === "none" && input.emitterMissing) {
    return { available: false, reason: `Para facturar falta: ${input.emitterMissing}` };
  }
  return { available: true, mode };
}

/** Mensaje de «la compra ya tenía factura», guardado en la orden para revisarla. */
export const EXTERNAL_INVOICE_NOTE =
  "La compra ya tenía una factura cargada en Mercado Libre (de otro medio): el sistema no la facturó.";
