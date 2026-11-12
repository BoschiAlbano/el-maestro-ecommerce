import { CertificateError, MAX_PEM_BYTES, daysUntilExpiration, generateCertificateRequest, validateCertificate } from "./certificate";
import { SecretBoxError } from "@/lib/secret-box";

// Carga del certificado de ARCA desde Configuración (specs/023, RF-2b a RF-2e).
// La base y el cifrado entran por `deps`, para probar todo sin base.
//
// Regla de oro: **la clave privada no sale de acá**. Nada de lo que devuelve
// este módulo para la pantalla la incluye; solo `loadForUse` la entrega, y es
// para el servidor.

export type FiscalEnvironment = "HOMOLOGACION" | "PRODUCCION";

export type CredentialRow = {
  certificatePem: string | null;
  privateKeyEnc: string | null;
  pendingKeyEnc: string | null;
  pendingCsrPem: string | null;
  cuit: string | null;
  expiresAt: Date | null;
  uploadedByUserId: string | null;
  uploadedAt: Date | null;
};

export type CredentialChange = {
  environment: FiscalEnvironment;
  /** `null` borra la fila entera. */
  row: CredentialRow | null;
  /** El permiso temporal guardado es de este certificado: si cambia, deja de servir. */
  deleteTickets: boolean;
  audit: { userId: string; detail: Record<string, string | number | boolean> };
};

export interface CredentialRepo {
  get(environment: FiscalEnvironment): Promise<CredentialRow | null>;
  /** Guarda el cambio, borra el permiso si corresponde y registra la auditoría, todo junto. */
  apply(change: CredentialChange): Promise<void>;
}

export type CredentialDeps = {
  repo: CredentialRepo;
  encrypt(plain: string): string;
  decrypt(stored: string): string;
  now(): Date;
};

export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}

const EMPTY_ROW: CredentialRow = {
  certificatePem: null,
  privateKeyEnc: null,
  pendingKeyEnc: null,
  pendingCsrPem: null,
  cuit: null,
  expiresAt: null,
  uploadedByUserId: null,
  uploadedAt: null,
};

/** Lo que la pantalla puede saber del certificado. Nunca la clave. */
export type CredentialStatus = {
  hasCertificate: boolean;
  cuit: string | null;
  expiresAt: Date | null;
  /** Negativo si ya venció. */
  daysLeft: number | null;
  uploadedAt: Date | null;
  uploadedByUserId: string | null;
  /** Hay un pedido generado que todavía espera el certificado de ARCA. */
  hasPendingRequest: boolean;
  /** El pedido pendiente, para volver a descargarlo. Es público. */
  pendingCsrPem: string | null;
};

/** Un archivo de certificado o de clave: texto, chico y con la forma esperada. */
export function assertPemText(text: string, label: string, marker: string): string {
  if (Buffer.byteLength(text, "utf8") > MAX_PEM_BYTES) {
    throw new CredentialError(`El archivo de ${label} es demasiado grande. Tiene que ser el texto que entrega ARCA.`);
  }
  if (!text.includes(marker)) {
    throw new CredentialError(`El archivo de ${label} no tiene el formato esperado.`);
  }
  return text.trim() + "\n";
}

export const assertCertificateText = (text: string) => assertPemText(text, "certificado", "BEGIN CERTIFICATE");
export const assertPrivateKeyText = (text: string) => assertPemText(text, "clave privada", "PRIVATE KEY");

export async function getStatus(deps: CredentialDeps, environment: FiscalEnvironment): Promise<CredentialStatus> {
  const row = await deps.repo.get(environment);
  return {
    hasCertificate: Boolean(row?.certificatePem && row.privateKeyEnc),
    cuit: row?.cuit ?? null,
    expiresAt: row?.expiresAt ?? null,
    daysLeft: row?.expiresAt ? daysUntilExpiration(row.expiresAt, deps.now()) : null,
    uploadedAt: row?.uploadedAt ?? null,
    uploadedByUserId: row?.uploadedByUserId ?? null,
    hasPendingRequest: Boolean(row?.pendingKeyEnc),
    pendingCsrPem: row?.pendingCsrPem ?? null,
  };
}

/**
 * Genera la clave y el pedido de certificado. Quedan como pendientes: el
 * certificado en uso no se toca hasta que llegue el nuevo (RF-2b).
 */
export async function generateRequest(
  deps: CredentialDeps,
  input: { environment: FiscalEnvironment; cuit: string; razonSocial: string; userId: string },
): Promise<{ csrPem: string; replacedPending: boolean }> {
  const row = (await deps.repo.get(input.environment)) ?? EMPTY_ROW;

  let generated;
  try {
    generated = generateCertificateRequest({
      cuit: input.cuit,
      organization: input.razonSocial,
      commonName: "ElMaestroSistema",
    });
  } catch (error) {
    if (error instanceof CertificateError) throw new CredentialError(error.message);
    throw error;
  }

  await deps.repo.apply({
    environment: input.environment,
    row: { ...row, pendingKeyEnc: deps.encrypt(generated.privateKeyPem), pendingCsrPem: generated.csrPem },
    deleteTickets: false,
    audit: { userId: input.userId, detail: { accion: "pedido generado", ambiente: input.environment } },
  });
  return { csrPem: generated.csrPem, replacedPending: Boolean(row.pendingKeyEnc) };
}

function describeValidation(error: unknown): never {
  if (error instanceof CertificateError) throw new CredentialError(error.message);
  throw error;
}

/** Instala el certificado que devolvió ARCA para el pedido pendiente (RF-2b, primera forma). */
export async function installFromPending(
  deps: CredentialDeps,
  input: { environment: FiscalEnvironment; certificatePem: string; expectedCuit: string; userId: string },
): Promise<{ cuit: string; expiresAt: Date }> {
  const row = await deps.repo.get(input.environment);
  if (!row?.pendingKeyEnc) {
    throw new CredentialError(
      "Primero generá el pedido de certificado y presentalo en ARCA. Si ya tenés un certificado y su clave, usá «Subir certificado y clave existentes».",
    );
  }

  let info;
  try {
    info = validateCertificate({
      certificatePem: input.certificatePem,
      privateKeyPem: deps.decrypt(row.pendingKeyEnc),
      expectedCuit: input.expectedCuit,
      now: deps.now(),
    });
  } catch (error) {
    if (error instanceof SecretBoxError) throw new CredentialError(SECRET_UNREADABLE);
    return describeValidation(error);
  }

  await deps.repo.apply({
    environment: input.environment,
    row: {
      certificatePem: input.certificatePem,
      privateKeyEnc: row.pendingKeyEnc,
      pendingKeyEnc: null,
      pendingCsrPem: null,
      cuit: info.cuit,
      expiresAt: info.validTo,
      uploadedByUserId: input.userId,
      uploadedAt: deps.now(),
    },
    deleteTickets: true,
    audit: {
      userId: input.userId,
      detail: { accion: "certificado cargado", ambiente: input.environment, cuit: info.cuit, vence: info.validTo.toISOString().slice(0, 10) },
    },
  });
  return { cuit: info.cuit, expiresAt: info.validTo };
}

/** Instala un certificado y su clave que ya existían (RF-2b, segunda forma). */
export async function installWithKey(
  deps: CredentialDeps,
  input: { environment: FiscalEnvironment; certificatePem: string; privateKeyPem: string; expectedCuit: string; userId: string },
): Promise<{ cuit: string; expiresAt: Date }> {
  let info;
  try {
    info = validateCertificate({
      certificatePem: input.certificatePem,
      privateKeyPem: input.privateKeyPem,
      expectedCuit: input.expectedCuit,
      now: deps.now(),
    });
  } catch (error) {
    return describeValidation(error);
  }

  const row = (await deps.repo.get(input.environment)) ?? EMPTY_ROW;
  await deps.repo.apply({
    environment: input.environment,
    // Un pedido pendiente de antes no se toca: es de otro trámite.
    row: {
      ...row,
      certificatePem: input.certificatePem,
      privateKeyEnc: deps.encrypt(input.privateKeyPem),
      cuit: info.cuit,
      expiresAt: info.validTo,
      uploadedByUserId: input.userId,
      uploadedAt: deps.now(),
    },
    deleteTickets: true,
    audit: {
      userId: input.userId,
      detail: { accion: "certificado y clave cargados", ambiente: input.environment, cuit: info.cuit, vence: info.validTo.toISOString().slice(0, 10) },
    },
  });
  return { cuit: info.cuit, expiresAt: info.validTo };
}

/** Quita el certificado del ambiente, y con él el pedido pendiente y el permiso guardado. */
export async function removeCertificate(
  deps: CredentialDeps,
  input: { environment: FiscalEnvironment; userId: string },
): Promise<void> {
  const row = await deps.repo.get(input.environment);
  if (!row) throw new CredentialError("No hay ningún certificado cargado en este ambiente.");

  await deps.repo.apply({
    environment: input.environment,
    row: null,
    deleteTickets: true,
    audit: { userId: input.userId, detail: { accion: "certificado quitado", ambiente: input.environment, cuit: row.cuit ?? "" } },
  });
}

const SECRET_UNREADABLE =
  "No se pudo leer la clave guardada: la clave de cifrado del servidor no coincide con la que se usó al guardarla. Hay que volver a cargar el certificado.";

/**
 * Lo único que entrega la clave privada, y solo para el servidor: el
 * certificado y la clave para hablar con ARCA.
 */
export async function loadForUse(
  deps: CredentialDeps,
  environment: FiscalEnvironment,
): Promise<{ certificatePem: string; privateKeyPem: string; cuit: string; expiresAt: Date }> {
  const row = await deps.repo.get(environment);
  if (!row?.certificatePem || !row.privateKeyEnc || !row.cuit || !row.expiresAt) {
    throw new CredentialError("Falta cargar el certificado de ARCA en Configuración > Facturación.");
  }
  if (row.expiresAt.getTime() <= deps.now().getTime()) {
    throw new CredentialError("El certificado de ARCA está vencido. Hay que cargar uno nuevo.");
  }
  try {
    return { certificatePem: row.certificatePem, privateKeyPem: deps.decrypt(row.privateKeyEnc), cuit: row.cuit, expiresAt: row.expiresAt };
  } catch (error) {
    if (error instanceof SecretBoxError) throw new CredentialError(SECRET_UNREADABLE);
    throw error;
  }
}

/** El modo real solo se activa en el sitio publicado (RF-2d). `vercelEnv` es `VERCEL_ENV`. */
export function canUseRealEnvironment(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}
