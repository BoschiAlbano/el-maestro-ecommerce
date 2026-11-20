// Lógica pura, sin I/O (mismo criterio que permissions.ts): quién puede ver y
// marcar como leído cada tipo de aviso de la campanita.
// Desde "enums" y no desde "client", para no arrastrar el runtime de Prisma.
import { ModuloNegocio, type NotificationType } from "@/generated/prisma/enums";
import { hasPermission, isOwner, type UserLike } from "@/lib/permissions";
import { NOTIFICATION_TAB, inTab, type NotificationTabFilter } from "@/lib/notification-tabs";

/**
 * Un aviso se ve con el permiso "ver" de un módulo, con el de cualquiera de
 * varios, o es solo para el Dueño.
 */
type NotificationAccess = { module: ModuloNegocio } | { anyOf: ModuloNegocio[] } | { ownerOnly: true };

/**
 * Cada aviso respeta el permiso "ver" de su propio módulo (specs/013, RF-7).
 * El de reconexión de Mercado Libre es de Configuración (specs/019, sección 6)
 * y, desde el 2026-11-20, también de quien ve Mercado Libre (specs/013,
 * sección 11): va en esa pestaña.
 * El del tope de facturación es solo del Dueño, igual que el acumulado que
 * avisa (specs/023, sección 6).
 * El de publicaciones de Mercado Libre, del módulo Mercado Libre (specs/020), igual
 * que los de órdenes (specs/022).
 * `Record` completo a propósito: agregar un tipo al enum sin decidir quién lo
 * ve no compila.
 */
export const NOTIFICATION_ACCESS: Record<NotificationType, NotificationAccess> = {
  PEDIDO_NUEVO: { module: ModuloNegocio.PEDIDOS },
  DIFERENCIA_CAJA: { module: ModuloNegocio.CAJA },
  ML_RECONEXION: { anyOf: [ModuloNegocio.CONFIGURACION, ModuloNegocio.MERCADO_LIBRE] },
  TOPE_FACTURACION: { ownerOnly: true },
  ML_PUBLICACION: { module: ModuloNegocio.MERCADO_LIBRE },
  ML_VENTA: { module: ModuloNegocio.MERCADO_LIBRE },
  ML_VENTA_SIN_STOCK: { module: ModuloNegocio.MERCADO_LIBRE },
  ML_CANCELACION: { module: ModuloNegocio.MERCADO_LIBRE },
  ML_FRAUDE: { module: ModuloNegocio.MERCADO_LIBRE },
};

/** A dónde lleva el aviso al tocarlo, si lleva a algún lado. */
export const NOTIFICATION_HREF: Partial<Record<NotificationType, string>> = {
  ML_RECONEXION: "/configuracion?tab=mercadolibre",
  TOPE_FACTURACION: "/comprobantes",
  ML_PUBLICACION: "/publicaciones",
  ML_VENTA: "/ordenes",
  ML_VENTA_SIN_STOCK: "/ordenes",
  ML_CANCELACION: "/ordenes",
  ML_FRAUDE: "/ordenes",
};

export function canSeeNotificationType(user: UserLike, type: NotificationType): boolean {
  const access = NOTIFICATION_ACCESS[type];
  if ("ownerOnly" in access) return isOwner(user);
  if ("anyOf" in access) return access.anyOf.some((module) => hasPermission(user, module, "ver"));
  return hasPermission(user, access.module, "ver");
}

export function visibleNotificationTypes(user: UserLike): NotificationType[] {
  return (Object.keys(NOTIFICATION_ACCESS) as NotificationType[]).filter((type) =>
    canSeeNotificationType(user, type),
  );
}

/**
 * Los tipos que marca «Marcar todas como leídas» en una pestaña (specs/013,
 * RF-11): los de esa pestaña que el usuario ve (RF-7), nunca los de la otra.
 */
export function typesToMarkRead(user: UserLike, tab: NotificationTabFilter): NotificationType[] {
  return visibleNotificationTypes(user).filter((type) => inTab(tab, NOTIFICATION_TAB[type]));
}

/**
 * Texto y destino del aviso para este usuario. El de reconexión de Mercado
 * Libre, a quien no puede reconectar (pide «editar» en Configuración), llega
 * sin enlace y con quién lo resuelve (specs/013, sección 11, permisos).
 */
export function presentNotification(user: UserLike, type: NotificationType, message: string): { message: string; href?: string } {
  if (type === "ML_RECONEXION" && !hasPermission(user, ModuloNegocio.CONFIGURACION, "editar")) {
    return { message: `${message} Avisale al Dueño para reconectarla.` };
  }
  return { message, href: NOTIFICATION_HREF[type] };
}
