import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyMlReconexion } from "@/lib/notifications";
import { readMlConfig } from "./config";
import { refreshAuthorization, requestAppAuthorization } from "./http";
import { decryptToken, encryptToken } from "./token-crypto";
import {
  getValidAccessToken as resolveAccessToken,
  type GetTokenOptions,
  type TokenManagerDeps,
} from "./token-manager";

// Arma `token-manager.ts` con la base, el cifrado y Mercado Libre reales
// (specs/019, plan sección 3.3).

const CONNECTION_ID = "singleton";

/**
 * Autorización vigente de la cuenta conectada; la renueva si hace falta.
 * Lanza `MlReconnectRequiredError` si no hay cuenta o el permiso dejó de
 * valer, y `MlUnavailableError` si Mercado Libre no responde.
 */
export function getValidAccessToken(options: GetTokenOptions = {}): Promise<string> {
  const config = readMlConfig();

  const deps: TokenManagerDeps = {
    now: () => new Date(),
    encrypt: (plain) => encryptToken(plain, config.encryptionKey),
    decrypt: (stored) => decryptToken(stored, config.encryptionKey),
    read: () => prisma.mercadoLibreConnection.findUnique({ where: { id: CONNECTION_ID } }),
    withLock: (fn) =>
      prisma.$transaction(
        async (tx) => {
          // Bloqueo por fila y dentro de la transacción: la aplicación se
          // conecta por el pooler de Supabase en modo transacción, donde los
          // bloqueos de sesión no sirven.
          await tx.$queryRaw`SELECT 1 FROM "ml_connections" WHERE "id" = ${CONNECTION_ID} FOR UPDATE`;
          const row = await tx.mercadoLibreConnection.findUnique({ where: { id: CONNECTION_ID } });
          return fn({
            row,
            saveRenewed: async (data) => {
              await tx.mercadoLibreConnection.update({ where: { id: CONNECTION_ID }, data });
            },
            markNeedsReconnect: async (reason) => {
              await tx.mercadoLibreConnection.update({
                where: { id: CONNECTION_ID },
                data: { status: "NEEDS_RECONNECT", statusReason: reason },
              });
            },
          });
        },
        // La renovación tarda unos 600 ms (prueba técnica); el margen cubre
        // una respuesta lenta de Mercado Libre sin dejar la fila tomada.
        { maxWait: 5_000, timeout: 15_000 },
      ),
    refresh: (refreshToken) => refreshAuthorization(config, refreshToken),
    onReconnectRequired: notifyMlReconexion,
  };

  return resolveAccessToken(deps, options);
}

/**
 * Permiso propio de la aplicación, sin usuario. Se pide cada vez que hace
 * falta y no se guarda: lo usa la recuperación de avisos perdidos, una vez
 * por día o a pedido. Lanza `MlTokenRequestError` si falla.
 */
export async function getAppAccessToken(): Promise<string> {
  const authorization = await requestAppAuthorization(readMlConfig());
  return authorization.accessToken;
}
