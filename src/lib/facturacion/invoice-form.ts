import { onlyDigits } from "./documentos";
import type { InvoiceRequest } from "./invoice-request";
import { requiresIdentification, validateReceiver } from "./invoice-policy";
import { IVA_CONSUMIDOR_FINAL, defaultIvaCondition, isIvaConditionAllowed } from "./iva-conditions";

// El bloque "Factura" de la pantalla de cobro (specs/023, RF-6 a RF-9), sin
// pantalla: de lo que se tipeó, qué pedido de factura sale y qué error mostrar.
// Pura, así se prueba sin navegador.

export type InvoiceForm = {
  /** La cajera pidió factura para esta venta. */
  enabled: boolean;
  /** Se identifica al comprador; si no, es Consumidor Final. */
  identify: boolean;
  docType: "DNI" | "CUIT";
  docNumber: string;
  name: string;
  ivaCondition: number;
};

export const EMPTY_INVOICE_FORM: InvoiceForm = {
  enabled: false,
  identify: false,
  docType: "DNI",
  docNumber: "",
  name: "",
  ivaCondition: IVA_CONSUMIDOR_FINAL,
};

/** Cambia el tipo de documento llevando la condición frente al IVA a un valor coherente. */
export function withDocType(form: InvoiceForm, docType: "DNI" | "CUIT"): InvoiceForm {
  return { ...form, docType, ivaCondition: defaultIvaCondition(docType) };
}

/**
 * El pedido de factura que sale de lo cargado, o el motivo por el que todavía
 * no se puede confirmar. Sin factura pedida: no hay pedido ni error.
 * `threshold`: desde qué total hay que identificar al comprador.
 */
export function buildInvoiceRequest(
  form: InvoiceForm,
  total: number,
  threshold: number,
): { request: InvoiceRequest | null; error: string | null } {
  if (!form.enabled) return { request: null, error: null };

  if (!form.identify) {
    if (requiresIdentification(total, threshold)) {
      return {
        request: null,
        error: "Por el monto, hay que identificar al comprador: ingresá su DNI o CUIT.",
      };
    }
    return { request: { receiver: { docType: "NONE", ivaCondition: IVA_CONSUMIDOR_FINAL } }, error: null };
  }

  const receiver = {
    docType: form.docType,
    docNumber: onlyDigits(form.docNumber),
    name: form.name.trim(),
    ivaCondition: form.ivaCondition,
  };
  if (!isIvaConditionAllowed(receiver.docType, receiver.ivaCondition)) {
    return { request: null, error: "Elegí la condición frente al IVA del comprador." };
  }
  const error = validateReceiver(receiver, total, threshold);
  return error ? { request: null, error } : { request: { receiver }, error: null };
}
