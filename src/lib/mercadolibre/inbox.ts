import { createHash } from "node:crypto";
import { z } from "zod";

// Lógica pura de los avisos de Mercado Libre (specs/019, RF-9 a RF-15; plan,
// sección 3.4). Sin base ni red: la usan la ruta que recibe los avisos, la
// recuperación de los perdidos y el procesamiento.

/** Después de estos intentos propios, un aviso fallido deja de reintentarse. */
export const MAX_ATTEMPTS = 5;

export type IncomingNotification = {
  /** Identificador propio del aviso, si Mercado Libre lo manda. */
  externalId?: string;
  topic: string;
  /** Qué cambió, por ejemplo `/orders/123`. Solo indica dónde mirar: no es un dato (RF-10). */
  resource: string;
  mlUserId: string;
  applicationId?: string;
  sentAt?: Date;
};

const id = z.union([z.number(), z.string()]).transform(String);

const notificationSchema = z.object({
  _id: z.string().min(1).optional(),
  topic: z.string().min(1),
  resource: z.string().min(1),
  user_id: id,
  application_id: id.optional(),
  sent: z.string().optional(),
});

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Lee un aviso que llega a la ruta. Devuelve `null` si no tiene la forma de un aviso. */
export function parseNotification(body: unknown): IncomingNotification | null {
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) return null;
  const { _id, topic, resource, user_id, application_id, sent } = parsed.data;
  return {
    externalId: _id,
    topic,
    resource,
    mlUserId: user_id,
    applicationId: application_id,
    sentAt: toDate(sent),
  };
}

/**
 * Lee la respuesta de los avisos perdidos. En la prueba técnica solo se vio
 * la respuesta vacía (`{"messages":null}`), así que se aceptan las dos formas
 * probables: el aviso en la propia entrada, o dentro de `request.data` /
 * `request.body` (la documentación lista `request` entre los campos). Lo que
 * no se entiende se ignora, no rompe la pasada.
 */
export function parseMissedFeeds(body: unknown): IncomingNotification[] {
  if (typeof body !== "object" || body === null) return [];
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];

  const found: IncomingNotification[] = [];
  for (const entry of messages) {
    const candidates: unknown[] = [entry];
    if (typeof entry === "object" && entry !== null) {
      const request = (entry as { request?: unknown }).request;
      if (typeof request === "object" && request !== null) {
        const { data, body: requestBody } = request as { data?: unknown; body?: unknown };
        candidates.push(data, requestBody);
        for (const value of [data, requestBody]) {
          if (typeof value === "string") {
            try {
              candidates.push(JSON.parse(value));
            } catch {
              // No era JSON.
            }
          }
        }
      }
    }
    const notification = candidates.map(parseNotification).find((n) => n !== null);
    if (notification) found.push(notification);
  }
  return found;
}

/**
 * Clave para no procesar dos veces el mismo aviso (RF-12): el identificador
 * del aviso si viene; si no, un hash de tema, recurso, cuenta y fecha de
 * envío. La fecha de envío entra a propósito: dos cambios distintos del mismo
 * recurso son dos avisos, y descartar el segundo dejaría un cambio sin ver.
 */
export function buildDedupeKey(n: IncomingNotification): string {
  if (n.externalId) return `id:${n.externalId}`;
  const raw = [n.topic, n.resource, n.mlUserId, n.sentAt?.toISOString() ?? ""].join("|");
  return `h:${createHash("sha256").update(raw).digest("hex")}`;
}

/**
 * ¿El aviso es de nuestra aplicación? Se compara en memoria, antes de guardar
 * nada (RF-11). Un aviso sin identificador de aplicación pasa: la cuenta se
 * controla después, al procesar.
 */
export function isOurApplication(n: IncomingNotification, clientId: string): boolean {
  return !n.applicationId || n.applicationId === clientId;
}

export type ProcessingDecision =
  /** No corresponde a la cuenta conectada, o no hay cuenta (RF-11). */
  | "discard"
  /** El sistema todavía no hace nada con ese tema (RF-15). */
  | "no_action"
  | "run";

export function decideProcessing(input: {
  connection: { mlUserId: string; status: "CONNECTED" | "NEEDS_RECONNECT" } | null;
  notificationMlUserId: string;
  hasHandler: boolean;
}): ProcessingDecision {
  const { connection } = input;
  if (!connection || connection.mlUserId !== input.notificationMlUserId) return "discard";
  return input.hasHandler ? "run" : "no_action";
}

export type FailureOutcome = { status: "PENDING" | "FAILED"; countAttempt: boolean };

/**
 * Qué pasa con un aviso cuando la función que lo procesa lanza un error.
 * Si Mercado Libre no responde, limitó las consultas o hay que reconectar, no
 * es culpa del aviso: queda pendiente y no suma intento (plan, 3.4, paso 4).
 */
export function outcomeAfterError(kind: "transient" | "other", attemptsSoFar: number): FailureOutcome {
  if (kind === "transient") return { status: "PENDING", countAttempt: false };
  return { status: attemptsSoFar + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", countAttempt: true };
}

/** Los fallidos que ya agotaron los intentos no se vuelven a tomar. */
export function isRetryable(status: string, attempts: number): boolean {
  return status === "PENDING" || (status === "FAILED" && attempts < MAX_ATTEMPTS);
}
