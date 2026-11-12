import { dateOnly, fiscalDate, oneYearBefore } from "./fechas";

// Acumulado facturado contra el tope del monotributo (specs/023, RF-25 y
// RF-27). Es solo informativo: nunca impide facturar (decisión del cliente,
// 2026-11-10). Funciones puras.

export type AccumulatedInvoice = {
  kind: "FACTURA_C" | "NOTA_CREDITO_C";
  status: "PENDING" | "AUTHORIZED" | "DISCARDED";
  environment: "HOMOLOGACION" | "PRODUCCION";
  total: number;
  /** Fecha del comprobante, sin hora, como la guarda la base (medianoche UTC). */
  issueDate: Date | null;
};

/** Parte del tope a partir de la cual se avisa. */
export const TOPE_WARNING_RATIO = 0.8;

/** Facturas menos notas de crédito, de lo que se le pase. Solo autorizados y reales. */
export function netInvoiced(invoices: AccumulatedInvoice[]): number {
  return invoices
    .filter((i) => i.status === "AUTHORIZED" && i.environment === "PRODUCCION")
    .reduce((sum, i) => sum + (i.kind === "FACTURA_C" ? i.total : -i.total), 0);
}

/**
 * Lo facturado en los últimos 12 meses: desde el mismo día del año anterior
 * (sin incluirlo) hasta hoy, en fechas de Tucumán. Los comprobantes de prueba
 * no cuentan.
 */
export function accumulatedLast12Months(invoices: AccumulatedInvoice[], now: Date): number {
  const from = oneYearBefore(now);
  const to = fiscalDate(now);
  return netInvoiced(
    invoices.filter((i) => {
      if (!i.issueDate) return false;
      const day = dateOnly(i.issueDate);
      return day > from && day <= to;
    }),
  );
}

/**
 * ¿Este comprobante hizo cruzar el umbral de aviso? Solo al cruzarlo hacia
 * arriba: una vez pasado, no vuelve a avisar (RF-27).
 */
export function crossedWarning(before: number, after: number, cap: number | null): boolean {
  if (!cap || cap <= 0) return false;
  const warningAt = cap * TOPE_WARNING_RATIO;
  return before < warningAt && after >= warningAt;
}

/** Porcentaje del tope usado, sin decimales; `null` si no hay tope cargado. */
export function capUsagePercent(accumulated: number, cap: number | null): number | null {
  if (!cap || cap <= 0) return null;
  return Math.round((accumulated / cap) * 100);
}
