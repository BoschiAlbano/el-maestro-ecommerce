import "server-only";
import { prisma } from "@/lib/prisma";
import { MlRateLimitError, MlReconnectRequiredError, MlUnavailableError } from "./errors";
import { notificationHandlers, type NotificationHandler } from "./handlers";
import {
  MAX_ATTEMPTS,
  buildDedupeKey,
  decideProcessing,
  outcomeAfterError,
  type IncomingNotification,
} from "./inbox";

// Guardar y procesar los avisos de Mercado Libre (specs/019; plan, 3.4). La
// tabla `ml_notifications` funciona como cola: la ruta guarda y responde, y el
// procesamiento viene después.

const CONNECTION_ID = "singleton";

function toRow(n: IncomingNotification, source: "WEBHOOK" | "RECOVERY") {
  return {
    dedupeKey: buildDedupeKey(n),
    topic: n.topic,
    resource: n.resource,
    mlUserId: n.mlUserId,
    source,
    sentAt: n.sentAt ?? null,
  };
}

/**
 * Guarda avisos con una sola escritura que ignora los repetidos (RF-12).
 * Devuelve cuántos eran nuevos. Es lo único que hace la ruta antes de
 * responder: Mercado Libre exige la confirmación en menos de 500 ms.
 */
export async function acceptNotifications(
  notifications: IncomingNotification[],
  source: "WEBHOOK" | "RECOVERY",
): Promise<number> {
  if (notifications.length === 0) return 0;
  const { count } = await prisma.mercadoLibreNotification.createMany({
    data: notifications.map((n) => toRow(n, source)),
    skipDuplicates: true,
  });
  return count;
}

/** Anota cuándo llegó el último aviso de la cuenta conectada (RF-3). */
export async function touchLastNotification(mlUserId: string): Promise<void> {
  await prisma.mercadoLibreConnection.updateMany({
    where: { id: CONNECTION_ID, mlUserId },
    data: { lastNotificationAt: new Date() },
  });
}

/**
 * Un error que no es culpa del aviso: Mercado Libre no responde, limitó las
 * consultas o hay que reconectar. El aviso espera a la próxima pasada.
 */
function isTransient(error: unknown): boolean {
  return (
    error instanceof MlUnavailableError ||
    error instanceof MlRateLimitError ||
    error instanceof MlReconnectRequiredError
  );
}

export type ProcessSummary = {
  processed: number;
  noAction: number;
  discarded: number;
  failed: number;
  stillPending: number;
};

/**
 * Procesa los avisos pendientes y los fallidos con intentos disponibles
 * (RF-14). Las funciones de `handlers.ts` son idempotentes (ver ese archivo),
 * así que dos pasadas que se crucen no duplican nada.
 */
export async function processPending(
  options: { limit?: number; handlers?: Record<string, NotificationHandler> } = {},
): Promise<ProcessSummary> {
  const handlers = options.handlers ?? notificationHandlers;
  const summary: ProcessSummary = { processed: 0, noAction: 0, discarded: 0, failed: 0, stillPending: 0 };

  const connection = await prisma.mercadoLibreConnection.findUnique({
    where: { id: CONNECTION_ID },
    select: { mlUserId: true, status: true },
  });

  const rows = await prisma.mercadoLibreNotification.findMany({
    where: { OR: [{ status: "PENDING" }, { status: "FAILED", attempts: { lt: MAX_ATTEMPTS } }] },
    orderBy: { receivedAt: "asc" },
    take: options.limit ?? 50,
  });

  for (const row of rows) {
    const handler = handlers[row.topic];
    const decision = decideProcessing({
      connection,
      notificationMlUserId: row.mlUserId,
      hasHandler: Boolean(handler),
    });

    if (decision === "discard") {
      await prisma.mercadoLibreNotification.update({
        where: { id: row.id },
        data: { status: "DISCARDED", processedAt: new Date() },
      });
      summary.discarded += 1;
      continue;
    }

    if (decision === "no_action") {
      await prisma.mercadoLibreNotification.update({
        where: { id: row.id },
        data: { status: "NO_ACTION", processedAt: new Date() },
      });
      summary.noAction += 1;
      continue;
    }

    try {
      await handler({ topic: row.topic, resource: row.resource, mlUserId: row.mlUserId });
      await prisma.mercadoLibreNotification.update({
        where: { id: row.id },
        data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
      });
      summary.processed += 1;
    } catch (error) {
      const outcome = outcomeAfterError(isTransient(error) ? "transient" : "other", row.attempts);
      await prisma.mercadoLibreNotification.update({
        where: { id: row.id },
        data: {
          status: outcome.status,
          attempts: outcome.countAttempt ? { increment: 1 } : undefined,
          // Solo el tipo de error: el mensaje podría traer datos del recurso.
          lastError: error instanceof Error ? error.name : "Error",
        },
      });
      if (outcome.status === "FAILED") summary.failed += 1;
      else summary.stillPending += 1;
    }
  }

  return summary;
}

/** Los avisos viejos no sirven de nada: se borran los de más de 30 días. */
export async function deleteOldNotifications(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.mercadoLibreNotification.deleteMany({ where: { receivedAt: { lt: cutoff } } });
  return count;
}
