// Aviso calculado de la campanita para las publicaciones de Mercado Libre
// (specs/021, RF-7). Puro: recibe la cantidad ya contada.
import type { LiveAlert } from "@/lib/facturacion/alerts";

/**
 * Un envío normal tarda segundos. Solo se avisa lo que lleva más que esto sin
 * enviarse, para que el aviso no aparezca y desaparezca en cada venta.
 */
export const PENDING_ALERT_MINUTES = 2;

/** Desde cuándo una marca pendiente cuenta para el aviso. */
export function pendingAlertCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_ALERT_MINUTES * 60_000);
}

/** Un solo aviso para precio, pausa y cantidad sin enviar. */
export function buildPendingSyncAlert(pendingCount: number): LiveAlert | null {
  if (pendingCount <= 0) return null;
  return {
    key: "mercadolibre-pendientes",
    message:
      pendingCount === 1
        ? "Hay 1 publicación con cambios sin enviar a Mercado Libre."
        : `Hay ${pendingCount} publicaciones con cambios sin enviar a Mercado Libre.`,
    href: "/publicaciones",
  };
}
