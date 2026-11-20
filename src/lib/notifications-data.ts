import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, isOwner, type UserLike } from "@/lib/permissions";
import { ModuloNegocio, type NotificationType } from "@/generated/prisma/client";
import { loadTravelList } from "@/lib/home-data";
import { isStockAlertActive, stillDismissed } from "@/lib/stock-alert";
import { buildInvoicingAlerts, type LiveAlert } from "@/lib/facturacion/alerts";
import { credentialDeps } from "@/lib/facturacion/credential-repo";
import { getStatus } from "@/lib/facturacion/credential-service";
import { getFiscalConfig } from "@/lib/facturacion/fiscal-data";
import { NOTIFICATION_HREF, canSeeNotificationType, visibleNotificationTypes } from "@/lib/notification-types";
import { buildPendingSyncAlert, pendingAlertCutoff } from "@/lib/mercadolibre/alerts";
import { buildOrderAlerts, DEADLINE_WARNING_HOURS } from "@/lib/mercadolibre/orders/order-alerts";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: Date;
  /** A dónde lleva el aviso al tocarlo; sin valor, es solo texto. */
  href?: string;
};

export type NotificationsSummary = {
  items: NotificationItem[];
  /** Avisos que se calculan cada vez y no se marcan como leídos (specs/023, RF-26). */
  liveAlerts: LiveAlert[];
  stockBajo: boolean;
  unreadCount: number;
};

/**
 * Los avisos de facturación que se calculan en el momento: comprobantes
 * pendientes y certificado por vencer. Solo para el Dueño, que es quien puede
 * resolverlos. Si no se puede consultar, no hay aviso: la campanita no falla.
 */
async function loadInvoicingAlerts(currentUser: UserLike): Promise<LiveAlert[]> {
  if (!isOwner(currentUser)) return [];
  try {
    const config = await getFiscalConfig();
    const [pendingCount, certificate] = await Promise.all([
      prisma.invoice.count({ where: { status: "PENDING", environment: config.environment } }),
      getStatus(credentialDeps(), config.environment),
    ]);
    return buildInvoicingAlerts({
      pendingCount,
      certificateDaysLeft: certificate.hasCertificate ? certificate.daysLeft : null,
    });
  } catch {
    return [];
  }
}

/**
 * Publicaciones de Mercado Libre con cambios sin enviar hace más de unos
 * minutos (specs/021, RF-7): precio, pausa o cantidad. Para quien ve el módulo
 * Mercado Libre. Si no se puede consultar, no hay aviso.
 */
async function loadMercadoLibreAlerts(currentUser: UserLike): Promise<LiveAlert[]> {
  if (!hasPermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "ver")) return [];
  try {
    const cutoff = pendingAlertCutoff(new Date());
    const pendingCount = await prisma.mercadoLibreListing.count({
      where: {
        linkedProductId: { not: null },
        OR: [
          { pricePendingSince: { lt: cutoff } },
          { pausePendingSince: { lt: cutoff } },
          { quantityPendingSince: { lt: cutoff } },
        ],
      },
    });
    const alert = buildPendingSyncAlert(pendingCount);

    // Órdenes por despachar (specs/022, RF-17 y RF-18).
    const now = new Date();
    const pending = { status: { in: ["TO_PREPARE" as const, "READY_TO_SHIP" as const] } };
    const [overdue, soon, fraud] = await Promise.all([
      prisma.mercadoLibreOrder.count({ where: { ...pending, dispatchDeadline: { lt: now } } }),
      prisma.mercadoLibreOrder.count({
        where: { ...pending, dispatchDeadline: { gte: now, lte: new Date(now.getTime() + DEADLINE_WARNING_HOURS * 3_600_000) } },
      }),
      prisma.mercadoLibreOrder.count({ where: { ...pending, fraudRisk: true } }),
    ]);

    return [...(alert ? [alert] : []), ...buildOrderAlerts({ soon, overdue, fraud })];
  } catch {
    return [];
  }
}

/**
 * Resumen de avisos (specs/013) — cada tipo filtrado por el permiso de su
 * propio módulo, igual criterio que el inicio (spec 012). El de stock bajo
 * no se persiste: reusa `loadTravelList` (spec 012) tal cual.
 */
export async function loadNotificationsSummary(currentUser: UserLike): Promise<NotificationsSummary> {
  const visibleTypes = visibleNotificationTypes(currentUser);

  const rows =
    visibleTypes.length === 0
      ? []
      : await prisma.notification.findMany({
          where: { readAt: null, type: { in: visibleTypes } },
          select: { id: true, type: true, message: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
  const items: NotificationItem[] = rows.map((row) => ({ ...row, href: NOTIFICATION_HREF[row.type] }));

  const travelList = await loadTravelList(currentUser);
  const lowIds = (travelList ?? []).map((item) => item.id);

  // Lo que se marcó como leído se poda a los productos que siguen bajo el mínimo:
  // uno repuesto que vuelve a bajar cuenta como nuevo y reaviva el aviso.
  const settings = await prisma.setting.findUnique({ where: { id: "singleton" } });
  const dismissed = settings?.stockAlertDismissedIds ?? [];
  const pruned = stillDismissed(lowIds, dismissed);
  if (settings && pruned.length !== dismissed.length) {
    await prisma.setting.update({ where: { id: "singleton" }, data: { stockAlertDismissedIds: pruned } });
  }
  const stockBajo = isStockAlertActive(lowIds, pruned);
  const liveAlerts = [...(await loadInvoicingAlerts(currentUser)), ...(await loadMercadoLibreAlerts(currentUser))];

  return {
    items,
    liveAlerts,
    stockBajo,
    unreadCount: items.length + liveAlerts.length + (stockBajo ? 1 : 0),
  };
}

export async function markNotificationRead(id: string, currentUser: UserLike): Promise<{ error?: string }> {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return { error: "El aviso no existe." };

  if (!canSeeNotificationType(currentUser, notification.type)) return { error: "No tenés permiso para esto." };

  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  return {};
}

/**
 * Marca como leído el aviso de stock bajo: guarda qué productos estaban bajo el
 * mínimo. Reaparece solo si después queda bajo algún producto que no estaba.
 * Es global, no por usuario (specs/013, igual que los otros avisos).
 */
export async function dismissStockAlert(currentUser: UserLike): Promise<{ error?: string }> {
  const travelList = await loadTravelList(currentUser);
  if (travelList === null) return { error: "No tenés permiso para esto." };

  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { stockAlertDismissedIds: travelList.map((item) => item.id) },
    create: { id: "singleton", stockAlertDismissedIds: travelList.map((item) => item.id) },
  });
  return {};
}
