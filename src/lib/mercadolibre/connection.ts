import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { isMlConfigured, readMlConfig } from "./config";
import { decideConnection } from "./connection-result";
import { mlHttp, type MlAuthorization } from "./http";
import { encryptToken } from "./token-crypto";
import { expiresAtFrom } from "./token-policy";
import { getValidAccessToken } from "./tokens";

// Guardar, mostrar y quitar la conexión con Mercado Libre (specs/019).

const CONNECTION_ID = "singleton";

/** Lo que la pantalla puede saber de la conexión. Nunca la autorización (RF-16). */
export type MlConnectionView = {
  /** Están cargadas las variables de la aplicación en el servidor. */
  configured: boolean;
  connection: {
    nickname: string;
    mlUserId: string;
    status: "CONNECTED" | "NEEDS_RECONNECT";
    statusReason: string | null;
    connectedAt: Date;
    lastNotificationAt: Date | null;
  } | null;
  pendingNotifications: number;
  failedNotifications: number;
};

export async function loadMlConnectionView(): Promise<MlConnectionView> {
  const [connection, pendingNotifications, failedNotifications] = await Promise.all([
    prisma.mercadoLibreConnection.findUnique({
      where: { id: CONNECTION_ID },
      // `select` explícito: los campos cifrados no salen de acá.
      select: {
        nickname: true,
        mlUserId: true,
        status: true,
        statusReason: true,
        connectedAt: true,
        lastNotificationAt: true,
      },
    }),
    prisma.mercadoLibreNotification.count({ where: { status: "PENDING" } }),
    prisma.mercadoLibreNotification.count({ where: { status: "FAILED" } }),
  ]);

  return { configured: isMlConfigured(), connection, pendingNotifications, failedNotifications };
}

export type MlAccount = { mlUserId: string; nickname: string; siteId: string };

/**
 * Guarda la cuenta que acaba de autorizar (RF-2), con su auditoría, en una
 * sola transacción. Si ya hay otra cuenta conectada no guarda nada (RF-8).
 */
export async function saveMlConnection(input: {
  userId: string;
  account: MlAccount;
  authorization: MlAuthorization & { refreshToken: string };
}): Promise<"saved" | "different_account"> {
  const { encryptionKey } = readMlConfig();
  const now = new Date();
  const data = {
    mlUserId: input.account.mlUserId,
    nickname: input.account.nickname,
    siteId: input.account.siteId,
    accessTokenEnc: encryptToken(input.authorization.accessToken, encryptionKey),
    refreshTokenEnc: encryptToken(input.authorization.refreshToken, encryptionKey),
    accessTokenExpiresAt: expiresAtFrom(now, input.authorization.expiresIn),
    status: "CONNECTED" as const,
    statusReason: null,
    lastRefreshedAt: now,
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.mercadoLibreConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: { mlUserId: true },
    });
    const decision = decideConnection(existing, input.account.mlUserId);
    if (decision === "different_account") return "different_account";

    if (decision === "create") {
      await tx.mercadoLibreConnection.create({
        data: { id: CONNECTION_ID, ...data, connectedAt: now, connectedByUserId: input.userId },
      });
    } else {
      // La misma cuenta vuelve a autorizar: se conserva desde cuándo está conectada.
      await tx.mercadoLibreConnection.update({ where: { id: CONNECTION_ID }, data });
    }

    await logAudit(tx, {
      userId: input.userId,
      action: "ML_CONNECTED",
      targetType: "MercadoLibreConnection",
      targetId: CONNECTION_ID,
      detail: {
        cuenta: input.account.nickname,
        mlUserId: input.account.mlUserId,
        reconexion: decision === "update",
      },
    });

    // El aviso de "hay que volver a conectar" ya no corresponde.
    await tx.notification.updateMany({
      where: { type: "ML_RECONEXION", readAt: null },
      data: { readAt: now },
    });

    return "saved";
  });
}

/** Quita el permiso del lado de Mercado Libre. Si no se puede, no frena la desconexión. */
async function revokeAtMercadoLibre(mlUserId: string): Promise<boolean> {
  try {
    const { clientId } = readMlConfig();
    const token = await getValidAccessToken();
    const response = await mlHttp("DELETE", `/users/${mlUserId}/applications/${clientId}`, { token });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Desconecta la cuenta (RF-6): revoca el permiso en Mercado Libre, borra la
 * autorización guardada y descarta los avisos que quedaban por procesar. El
 * historial del sistema no se toca.
 */
export async function disconnectMl(userId: string): Promise<"disconnected" | "not_connected"> {
  const connection = await prisma.mercadoLibreConnection.findUnique({
    where: { id: CONNECTION_ID },
    select: { mlUserId: true, nickname: true },
  });
  if (!connection) return "not_connected";

  const revoked = await revokeAtMercadoLibre(connection.mlUserId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.mercadoLibreConnection.delete({ where: { id: CONNECTION_ID } });
    // Sin autorización no se pueden procesar (spec, sección 7).
    await tx.mercadoLibreNotification.updateMany({
      where: { status: { in: ["PENDING", "FAILED"] } },
      data: { status: "DISCARDED", processedAt: now },
    });
    await tx.notification.updateMany({
      where: { type: "ML_RECONEXION", readAt: null },
      data: { readAt: now },
    });
    await logAudit(tx, {
      userId,
      action: "ML_DISCONNECTED",
      targetType: "MercadoLibreConnection",
      targetId: CONNECTION_ID,
      detail: {
        cuenta: connection.nickname,
        mlUserId: connection.mlUserId,
        revocadoEnMercadoLibre: revoked,
      },
    });
  });

  return "disconnected";
}
