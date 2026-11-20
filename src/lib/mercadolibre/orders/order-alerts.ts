// Avisos calculados de las órdenes de Mercado Libre (specs/022, RF-17 y RF-18;
// plan sección 3.6). Puro.
import type { MlOrderStatus } from "@/generated/prisma/enums";
import type { LiveAlert } from "@/lib/facturacion/alerts";
import { NOT_YET_SHIPPED } from "./order-status";

/** Con cuántas horas de anticipación se avisa el despacho (decisión del cliente, 2026-11-19). */
export const DEADLINE_WARNING_HOURS = 4;

export type DeadlineState = "overdue" | "soon" | null;

/** Si una orden que todavía no salió está por vencer o vencida. */
export function deadlineState(order: { status: MlOrderStatus; dispatchDeadline: Date | null }, now: Date): DeadlineState {
  if (!order.dispatchDeadline || !NOT_YET_SHIPPED.includes(order.status)) return null;
  const msLeft = order.dispatchDeadline.getTime() - now.getTime();
  if (msLeft < 0) return "overdue";
  if (msLeft <= DEADLINE_WARNING_HOURS * 3_600_000) return "soon";
  return null;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("N", String(count));
}

export function buildOrderAlerts(counts: { soon: number; overdue: number; fraud: number }): LiveAlert[] {
  const alerts: LiveAlert[] = [];
  if (counts.overdue > 0) {
    alerts.push({
      key: "ml-despacho-vencido",
      message: plural(counts.overdue, "Hay 1 orden de Mercado Libre con el despacho vencido.", "Hay N órdenes de Mercado Libre con el despacho vencido."),
      href: "/ordenes",
    });
  }
  if (counts.soon > 0) {
    alerts.push({
      key: "ml-despacho-por-vencer",
      message: plural(
        counts.soon,
        `Hay 1 orden de Mercado Libre que vence en menos de ${DEADLINE_WARNING_HOURS} horas.`,
        `Hay N órdenes de Mercado Libre que vencen en menos de ${DEADLINE_WARNING_HOURS} horas.`,
      ),
      href: "/ordenes",
    });
  }
  if (counts.fraud > 0) {
    alerts.push({
      key: "ml-fraude",
      message: plural(counts.fraud, "Hay 1 orden con riesgo de fraude: no la despaches.", "Hay N órdenes con riesgo de fraude: no las despaches."),
      href: "/ordenes",
    });
  }
  return alerts;
}
