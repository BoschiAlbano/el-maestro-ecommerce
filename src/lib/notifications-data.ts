import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserLike } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadTravelList } from "@/lib/home-data";

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
  const stockBajo = (travelList?.length ?? 0) > 0;

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
