// Pestaña, ícono y urgencia de cada aviso de la campanita, la hora relativa y
// los contadores por pestaña (specs/013, sección 11; plan sección 9.2). Pura:
// la usa también el componente del navegador.
// Desde "enums" y no desde "client", para no arrastrar el runtime de Prisma.
import type { NotificationType } from "@/generated/prisma/enums";

export type NotificationTab = "sistema" | "mercadolibre";
/** Las pestañas de la ventana: «Todos» junta las dos (RF-8). */
export type NotificationTabFilter = "todos" | NotificationTab;

/** Qué ícono lleva el aviso. El componente lo traduce a uno de `lucide-react`. */
export type NotificationIcon =
  | "pedido"
  | "caja"
  | "stock"
  | "factura"
  | "venta"
  | "cancelacion"
  | "fraude"
  | "envio"
  | "publicacion"
  | "conexion";

/**
 * En qué pestaña va cada aviso (RF-9). `Record` completo a propósito: un tipo
 * nuevo sin pestaña no compila (spec, sección 11, casos borde).
 */
export const NOTIFICATION_TAB: Record<NotificationType, NotificationTab> = {
  PEDIDO_NUEVO: "sistema",
  DIFERENCIA_CAJA: "sistema",
  TOPE_FACTURACION: "sistema",
  ML_RECONEXION: "mercadolibre",
  ML_PUBLICACION: "mercadolibre",
  ML_VENTA: "mercadolibre",
  ML_VENTA_SIN_STOCK: "mercadolibre",
  ML_CANCELACION: "mercadolibre",
  ML_FRAUDE: "mercadolibre",
};

export const NOTIFICATION_ICON: Record<NotificationType, NotificationIcon> = {
  PEDIDO_NUEVO: "pedido",
  DIFERENCIA_CAJA: "caja",
  TOPE_FACTURACION: "factura",
  ML_RECONEXION: "conexion",
  ML_PUBLICACION: "publicacion",
  ML_VENTA: "venta",
  ML_VENTA_SIN_STOCK: "stock",
  ML_CANCELACION: "cancelacion",
  ML_FRAUDE: "fraude",
};

/** Los que se destacan en rojo (RF-12). */
const URGENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>(["ML_FRAUDE", "ML_VENTA_SIN_STOCK", "ML_RECONEXION"]);

export function isUrgentType(type: NotificationType): boolean {
  return URGENT_TYPES.has(type);
}

export function inTab(filter: NotificationTabFilter, tab: NotificationTab): boolean {
  return filter === "todos" || filter === tab;
}

export type TabCounts = Record<NotificationTabFilter, number>;

/** Avisos sin leer por pestaña (RF-8). El de stock bajo es de Sistema y cuenta uno solo (sección 5). */
export function tabCounts(input: {
  items: readonly { tab: NotificationTab }[];
  liveAlerts: readonly { tab: NotificationTab }[];
  stockBajo: boolean;
}): TabCounts {
  const tabs = [...input.items, ...input.liveAlerts].map((entry) => entry.tab);
  if (input.stockBajo) tabs.push("sistema");
  const sistema = tabs.filter((tab) => tab === "sistema").length;
  return { todos: tabs.length, sistema, mercadolibre: tabs.length - sistema };
}

const TUCUMAN_TZ = "America/Argentina/Tucuman";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TUCUMAN_TZ }).format(date);
const clock = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: TUCUMAN_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
const dayMonth = (date: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: TUCUMAN_TZ, day: "2-digit", month: "2-digit" }).format(date);

/**
 * La hora de un aviso (RF-12): «hace un momento», «hace 5 min», «hace 3 h»
 * (si es de hoy), «ayer 18:40» o «12/11 18:40». En hora de Tucumán.
 */
export function relativeTime(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (dayKey(date) === dayKey(now)) return `hace ${Math.floor(minutes / 60)} h`;
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return `ayer ${clock(date)}`;
  return `${dayMonth(date)} ${clock(date)}`;
}
