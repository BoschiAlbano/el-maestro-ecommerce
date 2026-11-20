import { onlyDigits, type ReceiverDocType } from "./documentos";
import { dateOnly, fiscalDate } from "./fechas";

// Arma el pedido de autorización a ARCA (specs/023, RF-11 y RF-17). Función
// pura: no importa la biblioteca de ARCA; la forma es la del servicio web
// (WSFEv1), que la biblioteca acepta tal cual.

/** Códigos de tipo de comprobante de ARCA. */
export const VOUCHER_TYPE = { FACTURA_C: 11, NOTA_CREDITO_C: 13 } as const;

/** Códigos de tipo de documento del comprador. 99 es "Consumidor Final sin identificar". */
export const DOC_TYPE_CODE = { CUIT: 80, DNI: 96, NONE: 99 } as const satisfies Record<ReceiverDocType, number>;

export type ArcaVoucherRequest = {
  CantReg: 1;
  PtoVta: number;
  CbteTipo: number;
  /** 1 = productos. */
  Concepto: 1;
  DocTipo: number;
  DocNro: number;
  CbteDesde: number;
  CbteHasta: number;
  /** AAAAMMDD, en horario de Tucumán. */
  CbteFch: string;
  ImpTotal: number;
  ImpTotConc: 0;
  ImpNeto: number;
  ImpOpEx: 0;
  ImpIVA: 0;
  ImpTrib: 0;
  MonId: "PES";
  MonCotiz: 1;
  CondicionIVAReceptorId: number;
  CbtesAsoc?: { Tipo: number; PtoVta: number; Nro: number; Cuit: string; CbteFch: string }[];
};

export type VoucherInput = {
  kind: "FACTURA_C" | "NOTA_CREDITO_C";
  emitterCuit: string;
  pointOfSale: number;
  /** Número con el que se pide. Lo calcula el servicio a partir del último autorizado. */
  number: number;
  /** Total en pesos. Ya viene redondeado al peso desde la venta. */
  total: number;
  issueDate: Date;
  receiver: {
    docType: ReceiverDocType;
    docNumber?: string | null;
    /** Código de ARCA de la condición frente al IVA del comprador. */
    ivaCondition: number;
  };
  /**
   * La factura que deja sin efecto: obligatoria en una nota de crédito. Su
   * `issueDate` es una fecha sin hora, como la guarda la base.
   */
  associatedInvoice?: { pointOfSale: number; number: number; issueDate: Date };
};

/** Un MOMENTO, en horario de Tucumán: "2026-11-11" → "20261111". */
export function arcaDate(date: Date): string {
  return fiscalDate(date).replaceAll("-", "");
}

/** Una FECHA SIN HORA (medianoche UTC, como sale de la base): "20261111". Ver `dateOnly`. */
export function arcaDateOnly(date: Date): string {
  return dateOnly(date).replaceAll("-", "");
}

export class VoucherInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoucherInputError";
  }
}

export function buildVoucherRequest(input: VoucherInput): ArcaVoucherRequest {
  if (!Number.isFinite(input.total) || input.total <= 0) {
    throw new VoucherInputError("El total del comprobante tiene que ser mayor a cero.");
  }
  if (!Number.isInteger(input.number) || input.number < 1) {
    throw new VoucherInputError("El número de comprobante no es válido.");
  }
  if (input.kind === "NOTA_CREDITO_C" && !input.associatedInvoice) {
    throw new VoucherInputError("Una nota de crédito tiene que indicar la factura que anula.");
  }
  if (input.kind === "FACTURA_C" && input.associatedInvoice) {
    throw new VoucherInputError("Una factura no se asocia a otro comprobante.");
  }
  if (input.receiver.docType === "NONE" && input.receiver.docNumber) {
    throw new VoucherInputError("Un comprobante sin identificar al comprador no lleva número de documento.");
  }
  if (input.receiver.docType !== "NONE" && !onlyDigits(input.receiver.docNumber ?? "")) {
    throw new VoucherInputError("Falta el número de documento del comprador.");
  }

  // En pesos con dos decimales, sin arrastrar errores de coma flotante.
  const total = Math.round(input.total * 100) / 100;

  const request: ArcaVoucherRequest = {
    CantReg: 1,
    PtoVta: input.pointOfSale,
    CbteTipo: VOUCHER_TYPE[input.kind],
    Concepto: 1,
    DocTipo: DOC_TYPE_CODE[input.receiver.docType],
    DocNro: input.receiver.docType === "NONE" ? 0 : Number(onlyDigits(input.receiver.docNumber ?? "")),
    CbteDesde: input.number,
    CbteHasta: input.number,
    CbteFch: arcaDate(input.issueDate),
    // Factura C: el emisor es monotributista, no hay IVA. El total va como
    // importe neto y todo lo demás en cero.
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: input.receiver.ivaCondition,
  };

  if (input.associatedInvoice) {
    request.CbtesAsoc = [
      {
        Tipo: VOUCHER_TYPE.FACTURA_C,
        PtoVta: input.associatedInvoice.pointOfSale,
        Nro: input.associatedInvoice.number,
        Cuit: onlyDigits(input.emitterCuit),
        CbteFch: arcaDateOnly(input.associatedInvoice.issueDate),
      },
    ];
  }
  return request;
}
