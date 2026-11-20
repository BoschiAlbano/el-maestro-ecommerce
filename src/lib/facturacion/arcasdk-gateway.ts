import { Arca } from "@arcasdk/core";
import {
  ALREADY_AUTHENTICATED_MESSAGE,
  UNREACHABLE_MESSAGE,
  classifyArcaException,
  interpretVoucherResult,
} from "./arca-result";
import { onlyDigits } from "./documentos";
import { ArcaError, type ArcaGateway, type ExistingVoucher } from "./gateway";
import { TicketStorageError } from "./ticket-storage";
import type { ArcaVoucherRequest } from "./voucher";

// La implementación de `ArcaGateway` con `@arcasdk/core` (specs/023, plan
// secciones 3.1 y 8). Es el ÚNICO archivo que importa la biblioteca: cambiarla
// por otra o por una implementación directa toca solo este archivo.

type ArcaContext = ConstructorParameters<typeof Arca>[0];

export type ArcaGatewayOptions = {
  cuit: string;
  certificatePem: string;
  privateKeyPem: string;
  /** `false` = homologación (pruebas, sin validez fiscal). */
  production: boolean;
  /** Dónde se guarda el permiso temporal: siempre la base (`EncryptedTicketStorage`). */
  ticketStorage: ArcaContext["ticketStorage"];
  /** Tiempo máximo de cada llamada. Es lo que espera el cajero al cobrar con factura. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
/**
 * Pedir un permiso nuevo puede tardar más: ante el error de «permiso ya
 * entregado» la biblioteca reintenta y tarda unos 10 segundos en rendirse
 * (prueba técnica, 2026-11-11). Con un tiempo menor, ese error se vería como
 * una caída de red y el mensaje no explicaría qué pasó.
 */
const ACQUIRE_TIMEOUT_MS = 30_000;

function toArcaError(error: unknown): ArcaError {
  if (error instanceof ArcaError) return error;
  if (error instanceof TicketStorageError) return new ArcaError(error.message, "storage");

  switch (classifyArcaException(error)) {
    case "already_authenticated":
      return new ArcaError(ALREADY_AUTHENTICATED_MESSAGE, "already_authenticated");
    case "unreachable":
      return new ArcaError(UNREACHABLE_MESSAGE, "unreachable");
    default: {
      // El mensaje de la biblioteca puede traer datos internos; al usuario se
      // le dice solo que fue inesperado. El original queda en `cause`.
      const wrapped = new ArcaError("ARCA devolvió un error inesperado. Probá de nuevo.", "other");
      wrapped.cause = error;
      return wrapped;
    }
  }
}

async function withTimeout<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ArcaError(UNREACHABLE_MESSAGE, "unreachable")), ms);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createArcaGateway(options: ArcaGatewayOptions): ArcaGateway & {
  /** Pide un permiso nuevo a ARCA con una llamada barata. Solo bajo el bloqueo de `ensureTicket`. */
  acquirePermit(pointOfSale: number): Promise<void>;
} {
  const billing = new Arca({
    cuit: Number(onlyDigits(options.cuit)),
    cert: options.certificatePem,
    key: options.privateKeyPem,
    production: options.production,
    ticketStorage: options.ticketStorage,
  }).electronicBillingService;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call<T>(operation: () => Promise<T>, ms = timeoutMs): Promise<T> {
    try {
      return await withTimeout(operation(), ms);
    } catch (error) {
      throw toArcaError(error);
    }
  }

  async function lastNumber(pointOfSale: number, voucherType: number): Promise<number> {
    const result = await billing.getLastVoucher(pointOfSale, voucherType);
    return Number(result.cbteNro ?? 0);
  }

  return {
    async status() {
      const result = await call(() => billing.getServerStatus());
      return { app: result.appServer === "OK", db: result.dbServer === "OK", auth: result.authServer === "OK" };
    },

    lastNumber: (pointOfSale, voucherType) => call(() => lastNumber(pointOfSale, voucherType)),

    async acquirePermit(pointOfSale) {
      await call(() => lastNumber(pointOfSale, 11), ACQUIRE_TIMEOUT_MS);
    },

    async findVoucher(pointOfSale, voucherType, number): Promise<ExistingVoucher | null> {
      const info = await call(() => billing.getVoucherInfo(number, pointOfSale, voucherType));
      // Un comprobante que no existe vuelve como `null` o con el error 602,
      // según la versión (prueba técnica: devolvió `null`). Se aceptan las dos.
      if (!info || info.cbteDesde === undefined || info.cbteDesde === null) return null;
      return {
        number: Number(info.cbteDesde),
        issueDate: String(info.cbteFch ?? ""),
        total: Number(info.impTotal ?? 0),
        docType: Number(info.docTipo ?? 0),
        docNumber: Number(info.docNro ?? 0),
        cae: String(info.codAutorizacion ?? ""),
        caeExpiresAt: String(info.fchVto ?? ""),
        authorized: info.resultado === "A",
      };
    },

    async emit(request: ArcaVoucherRequest) {
      // Un rechazo de ARCA no lanza: vuelve como `Resultado: "R"` y se interpreta.
      const raw = await call(() => billing.createVoucher(request));
      return interpretVoucherResult(raw);
    },
  };
}
