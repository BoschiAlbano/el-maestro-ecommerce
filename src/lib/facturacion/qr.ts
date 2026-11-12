import { onlyDigits, type ReceiverDocType } from "./documentos";
import { dateOnly } from "./fechas";
import { DOC_TYPE_CODE, VOUCHER_TYPE } from "./voucher";

// Código QR de la factura (specs/023, RF-20). Formato oficial de ARCA,
// versión 1: `https://www.arca.gob.ar/fe/qr/?p=<JSON en Base64>`. Está
// especificado en https://www.arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
// y esa especificación trae un ejemplo completo que usan las pruebas.
//
// El QR no reemplaza los datos visibles del comprobante: se suma a ellos.

export const QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/";

/**
 * Datos del QR, en el orden de la especificación. El orden importa solo para
 * poder comparar con el ejemplo oficial: ARCA lee el JSON por nombre de campo.
 */
export type QrPayload = {
  ver: 1;
  /** AAAA-MM-DD. */
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: string;
  ctz: number;
  tipoDocRec?: number;
  nroDocRec?: number;
  /** "E" = autorizado por CAE; "A" = por CAEA. Siempre "E": no se usa CAEA. */
  tipoCodAut: "E" | "A";
  codAut: number;
};

export function encodeQrPayload(payload: QrPayload): string {
  return `${QR_BASE_URL}?p=${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

export type QrInvoice = {
  kind: "FACTURA_C" | "NOTA_CREDITO_C";
  emitterCuit: string;
  pointOfSale: number;
  number: number;
  total: number;
  /** La fecha del comprobante, sin hora, como la guarda la base (medianoche UTC). */
  issueDate: Date;
  /** Código de autorización de 14 dígitos que devolvió ARCA. */
  cae: string;
  receiverDocType: ReceiverDocType;
  receiverDocNumber?: string | null;
};

/** Dirección que va codificada en el QR de un comprobante autorizado. */
export function buildQrUrl(invoice: QrInvoice): string {
  const payload: QrPayload = {
    ver: 1,
    fecha: dateOnly(invoice.issueDate),
    cuit: Number(onlyDigits(invoice.emitterCuit)),
    ptoVta: invoice.pointOfSale,
    tipoCmp: VOUCHER_TYPE[invoice.kind],
    nroCmp: invoice.number,
    importe: Math.round(invoice.total * 100) / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: DOC_TYPE_CODE[invoice.receiverDocType],
    nroDocRec: invoice.receiverDocType === "NONE" ? 0 : Number(onlyDigits(invoice.receiverDocNumber ?? "")),
    tipoCodAut: "E",
    codAut: Number(invoice.cae),
  };
  return encodeQrPayload(payload);
}
