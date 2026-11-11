// Lógica pura, sin I/O (mismo criterio que permissions.ts): qué permiso hace
// falta para ver y marcar como leído cada tipo de aviso de la campanita.
// Desde "enums" y no desde "client", para no arrastrar el runtime de Prisma.
import { ModuloNegocio, type NotificationType } from "@/generated/prisma/enums";
import { hasPermission, type UserLike } from "@/lib/permissions";

/**
 * Cada aviso respeta el permiso "ver" de su propio módulo (specs/013, RF-7).
 * El de reconexión de Mercado Libre es de Configuración (specs/019, sección 6).
 * `Record` completo a propósito: agregar un tipo al enum sin decidir su
 * permiso no compila.
 */
export const NOTIFICATION_MODULE: Record<NotificationType, ModuloNegocio> = {
  PEDIDO_NUEVO: ModuloNegocio.PEDIDOS,
  DIFERENCIA_CAJA: ModuloNegocio.CAJA,
  ML_RECONEXION: ModuloNegocio.CONFIGURACION,
};

/** A dónde lleva el aviso al tocarlo, si lleva a algún lado. */
export const NOTIFICATION_HREF: Partial<Record<NotificationType, string>> = {
  ML_RECONEXION: "/configuracion?tab=mercadolibre",
};

export function canSeeNotificationType(user: UserLike, type: NotificationType): boolean {
  return hasPermission(user, NOTIFICATION_MODULE[type], "ver");
}

export function visibleNotificationTypes(user: UserLike): NotificationType[] {
  return (Object.keys(NOTIFICATION_MODULE) as NotificationType[]).filter((type) =>
    canSeeNotificationType(user, type),
  );
}
