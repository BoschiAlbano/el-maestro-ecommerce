import "server-only";
import { prisma } from "@/lib/prisma";
import { createArcaGateway } from "./arcasdk-gateway";
import { credentialDeps } from "./credential-repo";
import { CredentialError, loadForUse } from "./credential-service";
import { onlyDigits } from "./documentos";
import { ensureTicket } from "./ensure-ticket";
import { getFiscalConfig, type FiscalConfigView } from "./fiscal-data";
import type { ArcaGateway } from "./gateway";
import { EncryptedTicketStorage } from "./ticket-storage";
import { prismaTicketRepo } from "./ticket-repo";

// Una sesión con ARCA para el ambiente configurado (specs/023, plan 3.1 y
// 3.3b): la conexión, ya con el certificado y el almacenamiento del permiso.

export type ArcaSession = {
  gateway: ArcaGateway;
  config: FiscalConfigView;
  environment: "HOMOLOGACION" | "PRODUCCION";
  cuit: string;
  pointOfSale: number;
  /** Garantiza que haya un permiso guardado, pidiéndolo bajo bloqueo si hace falta. */
  ensureTicket(): Promise<"existing" | "acquired">;
};

/**
 * Toma la fila de configuración con `SELECT … FOR UPDATE` mientras dura `fn`:
 * de a un proceso por vez. Es el mismo bloqueo con el que se emite un
 * comprobante (plan, 3.3), porque los dos hablan con ARCA y comparten el
 * permiso temporal y la numeración.
 */
export function withFiscalLock<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "fiscal_config" WHERE "id" = 'singleton' FOR UPDATE`;
      return fn();
    },
    // Pedir un permiso nuevo puede tardar unos 30 segundos si ARCA lo rechaza.
    { maxWait: 10_000, timeout: 60_000 },
  );
}

export async function openArcaSession(): Promise<ArcaSession> {
  const config = await getFiscalConfig();
  if (!config.puntoDeVenta) throw new CredentialError("Falta cargar el punto de venta en Configuración > Facturación.");

  const deps = credentialDeps();
  const credentials = await loadForUse(deps, config.environment);
  if (credentials.cuit !== onlyDigits(config.cuit)) {
    throw new CredentialError("El certificado de ARCA es de otro CUIT que el cargado en los datos del emisor.");
  }

  const storage = new EncryptedTicketStorage(prismaTicketRepo, {
    environment: config.environment,
    cuit: credentials.cuit,
    encrypt: deps.encrypt,
    decrypt: deps.decrypt,
  });
  const gateway = createArcaGateway({
    cuit: credentials.cuit,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
    production: config.environment === "PRODUCCION",
    ticketStorage: storage,
  });
  const pointOfSale = config.puntoDeVenta;

  return {
    gateway,
    config,
    environment: config.environment,
    cuit: credentials.cuit,
    pointOfSale,
    ensureTicket: () =>
      ensureTicket({
        hasValidTicket: () => storage.hasValid("wsfe"),
        withLock: withFiscalLock,
        acquire: () => gateway.acquirePermit(pointOfSale),
      }),
  };
}
