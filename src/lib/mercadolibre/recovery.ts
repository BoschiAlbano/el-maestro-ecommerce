import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MlApiError } from "./errors";
import { readMlConfig } from "./config";
import { mlHttp } from "./http";
import { parseMissedFeeds, type IncomingNotification } from "./inbox";
import { acceptNotifications, deleteOldNotifications, processPending, type ProcessSummary } from "./inbox-store";
import { mlFetch } from "./client";
import { getAppAccessToken } from "./tokens";

// Recuperación de avisos perdidos y pasada de mantenimiento (specs/019, RF-13
// y RF-14; plan, sección 3.5). La corre la tarea diaria y el botón "Buscar
// avisos pendientes".

const CONNECTION_ID = "singleton";
const PAGE_SIZE = 50;
/** Tope de páginas por consulta, por si Mercado Libre devolviera siempre lo mismo. */
const MAX_PAGES = 20;

/**
 * Pide los avisos perdidos. Se usa el permiso propio de la aplicación y no el
 * de la cuenta conectada: solo la dueña de la aplicación puede verlos (prueba
 * técnica, P-6). Mercado Libre guarda los perdidos solo 2 días.
 */
async function fetchMissedFeeds(appToken: string, query: string): Promise<IncomingNotification[]> {
  const all: IncomingNotification[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await mlHttp("GET", `/missed_feeds?${query}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
      token: appToken,
    });
    if (response.status !== 200) throw new MlApiError(response.status, response.body);

    const batch = parseMissedFeeds(response.body);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

export type MaintenanceSummary =
  | { skipped: true; reason: "not_connected" }
  | {
      skipped: false;
      found: number;
      saved: number;
      ignoredOtherAccount: number;
      process: ProcessSummary;
      deletedOld: number;
    };

/**
 * Pasada completa: renueva la autorización (así la credencial de renovación se
 * mantiene viva aunque nadie use el sistema), trae los avisos perdidos de la
 * cuenta conectada, procesa los pendientes y limpia los viejos.
 * Lanza el error de Mercado Libre si algo falla; quien llama decide qué mostrar.
 */
export async function runMaintenance(): Promise<MaintenanceSummary> {
  const connection = await prisma.mercadoLibreConnection.findUnique({
    where: { id: CONNECTION_ID },
    select: { mlUserId: true, siteId: true, status: true },
  });
  if (!connection) return { skipped: true, reason: "not_connected" };

  const { clientId } = readMlConfig();

  // Con la conexión pidiendo reconexión no hay nada que verificar; igual se
  // procesa lo que haya, que es solo descartar o dejar pendiente.
  //
  // Se consulta la cuenta con su propia autorización, no solo se la renueva:
  // así un permiso revocado desde Mercado Libre se detecta en esta pasada
  // (el rechazo fuerza una renovación, que da `invalid_grant` y marca que hay
  // que reconectar) y no recién cuando la autorización venza, hasta 6 horas
  // después. De paso, la renovación mantiene viva la credencial de renovación.
  if (connection.status === "CONNECTED") {
    await mlFetch("/users/me", { schema: z.object({ id: z.union([z.number(), z.string()]) }) });
  }

  const appToken = await getAppAccessToken();
  // Para el tema de publicaciones Mercado Libre exige el sitio; sin tema trae
  // el resto. Se piden las dos y los repetidos los descarta la clave única.
  const found = [
    ...(await fetchMissedFeeds(appToken, `app_id=${clientId}`)),
    ...(await fetchMissedFeeds(appToken, `app_id=${clientId}&topic=items&site_id=${connection.siteId}`)),
  ];

  const mine = found.filter((n) => n.mlUserId === connection.mlUserId);
  const saved = await acceptNotifications(mine, "RECOVERY");

  const process = await processPending({ limit: 200 });
  const deletedOld = await deleteOldNotifications();

  await prisma.mercadoLibreConnection.updateMany({
    where: { id: CONNECTION_ID },
    data: { lastRecoveryAt: new Date() },
  });

  return {
    skipped: false,
    found: found.length,
    saved,
    ignoredOtherAccount: found.length - mine.length,
    process,
    deletedOld,
  };
}
