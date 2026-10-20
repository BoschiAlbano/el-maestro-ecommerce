import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserLike } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadTravelList } from "@/lib/home-data";
import { isStockAlertActive, stillDismissed } from "@/lib/stock-alert";

export type NotificationItem = {
  id: string;
  type: "PEDIDO_NUEVO" | "DIFERENCIA_CAJA";
  message: string;
  createdAt: Date;
};

export type NotificationsSummary = {
  items: NotificationItem[];
  stockBajo: boolean;
  unreadCount: number;
};

/**
 * Resumen de avisos (specs/013) — cada tipo filtrado por el permiso de su
 * propio módulo, igual criterio que el inicio (spec 012). El de stock bajo
 * no se persiste: reusa `loadTravelList` (spec 012) tal cual.
 */
export async function loadNotificationsSummary(currentUser: UserLike): Promise<NotificationsSummary> {
  const visibleTypes: ("PEDIDO_NUEVO" | "DIFERENCIA_CAJA")[] = [];
  if (hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) visibleTypes.push("PEDIDO_NUEVO");
  if (hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) visibleTypes.push("DIFERENCIA_CAJA");

  const items =
    visibleTypes.length === 0
      ? []
      : await prisma.notification.findMany({
          where: { readAt: null, type: { in: visibleTypes } },
          select: { id: true, type: true, message: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });

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

  return {
    items,
    stockBajo,
    unreadCount: items.length + (stockBajo ? 1 : 0),
  };
}

export async function markNotificationRead(id: string, currentUser: UserLike): Promise<{ error?: string }> {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return { error: "El aviso no existe." };

  const requiredModule: ModuloNegocio =
    notification.type === "PEDIDO_NUEVO" ? ModuloNegocio.PEDIDOS : ModuloNegocio.CAJA;
  if (!hasPermission(currentUser, requiredModule, "ver")) return { error: "No tenés permiso para esto." };

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
