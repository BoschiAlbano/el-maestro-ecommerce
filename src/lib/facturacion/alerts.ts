// Avisos de la campanita que NO se guardan: se calculan cada vez y desaparecen
// solos cuando el problema se resuelve (specs/023, RF-26). Pura.
import type { NotificationIcon, NotificationTab } from "@/lib/notification-tabs";

export type LiveAlert = {
  key: string;
  message: string;
  href: string;
  /** Pestaña, ícono y si se destaca en rojo (specs/013, sección 11). Obligatorios: un aviso nuevo tiene que decidirlos. */
  tab: NotificationTab;
  icon: NotificationIcon;
  urgent: boolean;
};

/** Con cuántos días de margen se avisa que el certificado está por vencer. */
export const CERTIFICATE_WARNING_DAYS = 30;

export function buildInvoicingAlerts(input: {
  /** Comprobantes que quedaron pendientes de emitir. */
  pendingCount: number;
  /** Días que le quedan al certificado en uso; negativo si ya venció; `null` si no hay. */
  certificateDaysLeft: number | null;
}): LiveAlert[] {
  const alerts: LiveAlert[] = [];

  if (input.pendingCount > 0) {
    alerts.push({
      key: "facturas-pendientes",
      message:
        input.pendingCount === 1
          ? "Hay 1 comprobante pendiente de emitir en ARCA."
          : `Hay ${input.pendingCount} comprobantes pendientes de emitir en ARCA.`,
      href: "/comprobantes?estado=PENDING",
      tab: "sistema",
      icon: "factura",
      urgent: false,
    });
  }

  const days = input.certificateDaysLeft;
  if (days !== null && days <= CERTIFICATE_WARNING_DAYS) {
    alerts.push({
      key: "certificado-por-vencer",
      message:
        days < 0
          ? "El certificado de ARCA venció: no se puede facturar hasta cargar uno nuevo."
          : days === 0
            ? "El certificado de ARCA vence hoy. Renovalo para seguir facturando."
            : `El certificado de ARCA vence en ${days} ${days === 1 ? "día" : "días"}. Renovalo para seguir facturando.`,
      href: "/configuracion?tab=facturacion",
      tab: "sistema",
      icon: "factura",
      urgent: false,
    });
  }
  return alerts;
}
