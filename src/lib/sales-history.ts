import { addDaysToDateKey, toTucumanDateKey, tucumanMidnightUtc } from "@/lib/analytics";

export type SalesPeriod = "turno" | "hoy" | "7dias" | "todas";

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  turno: "Caja actual",
  hoy: "Hoy",
  "7dias": "Últimos 7 días",
  todas: "Todas",
};

const PERIODS = Object.keys(SALES_PERIOD_LABELS) as SalesPeriod[];

/**
 * Período del historial de ventas (specs/008, RF-15). Por defecto es la caja
 * actual; si no hay ninguna abierta, "hoy" — para no mostrar una pantalla vacía.
 * "turno" pedido sin caja abierta también cae en "hoy".
 */
export function parseSalesPeriod(raw: string | undefined, hasOpenShift: boolean): SalesPeriod {
  const requested = PERIODS.find((p) => p === raw);
  if (requested === "turno" && !hasOpenShift) return "hoy";
  return requested ?? (hasOpenShift ? "turno" : "hoy");
}

/**
 * Rango de fechas del período, en horario de Tucumán (mismos helpers que las
 * analíticas, spec 011). `null` = sin rango por fecha ("turno" se filtra por
 * el turno abierto y "todas" no filtra).
 */
export function salesPeriodRange(period: SalesPeriod, now: Date): { from: Date; to: Date } | null {
  if (period !== "hoy" && period !== "7dias") return null;
  const todayKey = toTucumanDateKey(now);
  const fromKey = period === "hoy" ? todayKey : addDaysToDateKey(todayKey, -6);
  return {
    from: tucumanMidnightUtc(fromKey),
    to: tucumanMidnightUtc(addDaysToDateKey(todayKey, 1)),
  };
}
