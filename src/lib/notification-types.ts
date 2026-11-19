// Lógica pura, sin I/O (mismo criterio que permissions.ts): quién puede ver y
// marcar como leído cada tipo de aviso de la campanita.
// Desde "enums" y no desde "client", para no arrastrar el runtime de Prisma.
import { ModuloNegocio, type NotificationType } from "@/generated/prisma/enums";
import { hasPermission, isOwner, type UserLike } from "@/lib/permissions";

/** Un aviso se ve con el permiso "ver" de un módulo, o es solo para el Dueño. */
type NotificationAccess = { module: ModuloNegocio } | { ownerOnly: true };

/**
 * Cada aviso respeta el permiso "ver" de su propio módulo (specs/013, RF-7).
 * El de reconexión de Mercado Libre es de Configuración (specs/019, sección 6).
 * El del tope de facturación es solo del Dueño, igual que el acumulado que
 * avisa (specs/023, sección 6).
 * El de publicaciones de Mercado Libre, del módulo Mercado Libre (specs/020).
 * `Record` completo a propósito: agregar un tipo al enum sin decidir quién lo
 * ve no compila.
 */
export const NOTIFICATION_ACCESS: Record<NotificationType, NotificationAccess> = {
  PEDIDO_NUEVO: { module: ModuloNegocio.PEDIDOS },
  DIFERENCIA_CAJA: { module: ModuloNegocio.CAJA },
  ML_RECONEXION: { module: ModuloNegocio.CONFIGURACION },
  TOPE_FACTURACION: { ownerOnly: true },
  ML_PUBLICACION: { module: ModuloNegocio.MERCADO_LIBRE },
};

/** A dónde lleva el aviso al tocarlo, si lleva a algún lado. */
export const NOTIFICATION_HREF: Partial<Record<NotificationType, string>> = {
  ML_RECONEXION: "/configuracion?tab=mercadolibre",
  TOPE_FACTURACION: "/comprobantes",
  ML_PUBLICACION: "/publicaciones",
};

export function canSeeNotificationType(user: UserLike, type: NotificationType): boolean {
  const access = NOTIFICATION_ACCESS[type];
  return "ownerOnly" in access ? isOwner(user) : hasPermission(user, access.module, "ver");
}

export function visibleNotificationTypes(user: UserLike): NotificationType[] {
  return (Object.keys(NOTIFICATION_ACCESS) as NotificationType[]).filter((type) =>
    canSeeNotificationType(user, type),
  );
}
