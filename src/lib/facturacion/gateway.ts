import type { VoucherOutcome } from "./arca-result";
import type { ArcaVoucherRequest } from "./voucher";

// La interfaz propia hacia ARCA (specs/023, plan sección 3.1). El resto del
// sistema solo conoce esto: la biblioteca que habla con ARCA vive detrás, en
// `arcasdk-gateway.ts`, y se puede cambiar sin tocar nada más. En las pruebas
// se reemplaza por una versión simulada.

export type ArcaServerStatus = { app: boolean; db: boolean; auth: boolean };

/** Un comprobante que ARCA ya tiene registrado. */
export type ExistingVoucher = {
  number: number;
  /** AAAAMMDD, como lo informa ARCA. */
  issueDate: string;
  total: number;
  /** Código de tipo de documento del comprador (80 CUIT, 96 DNI, 99 sin identificar). */
  docType: number;
  docNumber: number;
  cae: string;
  /** AAAAMMDD: hasta cuándo vale el código de autorización. Vacío si ARCA no lo informa. */
  caeExpiresAt: string;
  authorized: boolean;
};

export interface ArcaGateway {
  /** Estado del servicio de ARCA. No necesita permiso. */
  status(): Promise<ArcaServerStatus>;
  /** Último número autorizado del tipo de comprobante, en el punto de venta. 0 si no hay ninguno. */
  lastNumber(pointOfSale: number, voucherType: number): Promise<number>;
  /** El comprobante con ese número, o `null` si ARCA no lo tiene. */
  findVoucher(pointOfSale: number, voucherType: number, number: number): Promise<ExistingVoucher | null>;
  /**
   * Pide la autorización. Un rechazo NO lanza: vuelve como `rejected`. Lanza
   * `ArcaError` solo cuando no se pudo hablar con ARCA o ARCA no entregó un
   * resultado utilizable.
   */
  emit(request: ArcaVoucherRequest): Promise<VoucherOutcome>;
}

/** Por qué falló la comunicación con ARCA (no un rechazo del comprobante). */
export type ArcaFailureKind = "already_authenticated" | "unreachable" | "storage" | "other";

export class ArcaError extends Error {
  constructor(
    message: string,
    readonly failure: ArcaFailureKind,
  ) {
    super(message);
    this.name = "ArcaError";
  }
}
