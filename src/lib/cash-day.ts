import { addDaysToDateKey, tucumanMidnightUtc } from "./analytics";
import { summarizeShift, type CashMovementForExpected, type ShiftSummary } from "./cash-shift";

/**
 * Lógica pura de la caja del día (specs/014): totales de un día completo,
 * sumando todos los turnos. La fuente de verdad sigue siendo el ledger de
 * movimientos de la spec 007; acá solo se suma.
 */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fecha `AAAA-MM-DD` pedida en la URL. Si no existe, no es una fecha real o
 * es futura, vuelve a hoy (specs/014, sección 7). Las claves de fecha ordenan
 * bien como texto, por eso se comparan con `>`.
 */
export function parseDayKey(raw: string | undefined, todayKey: string): string {
  if (!raw || !DAY_KEY.test(raw)) return todayKey;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return todayKey;
  return raw > todayKey ? todayKey : raw;
}

/**
 * Totales en efectivo y en transferencia del día. Con monto inicial 0 el
 * "efectivo esperado" de `summarizeShift` es justamente el efectivo neto: los
 * montos iniciales de los turnos no se suman porque un turno suele arrancar
 * con lo que dejó el anterior (specs/014, sección 5).
 */
export function summarizeDay(movements: CashMovementForExpected[]): ShiftSummary {
  return summarizeShift(0, movements);
}

export type SaleForTotals = { total: number; voided: boolean };

export type SalesSummary = {
  count: number;
  total: number;
  voidedCount: number;
  voidedTotal: number;
};

/** Cantidad y monto de las ventas del día; las anuladas no cuentan como ventas. */
export function summarizeSales(sales: SaleForTotals[]): SalesSummary {
  const summary: SalesSummary = { count: 0, total: 0, voidedCount: 0, voidedTotal: 0 };
  for (const sale of sales) {
    if (sale.voided) {
      summary.voidedCount += 1;
      summary.voidedTotal += sale.total;
    } else {
      summary.count += 1;
      summary.total += sale.total;
    }
  }
  return summary;
}

export type SaleMovement = CashMovementForExpected & { saleId: string | null };

/**
 * Lo cobrado por ventas, por medio de pago. Las ventas no guardan su medio de
 * pago: sale de los movimientos que vienen de una venta (el cobro suma y la
 * devolución por anulación resta). Las señas y los movimientos manuales no
 * tienen `saleId`, así que no entran.
 */
export function collectedBySales(movements: SaleMovement[]): { efectivo: number; transferencia: number } {
  const result = { efectivo: 0, transferencia: 0 };
  for (const movement of movements) {
    if (!movement.saleId) continue;
    const signed = movement.type === "INGRESO" ? movement.amount : -movement.amount;
    if (movement.paymentMethod === "EFECTIVO") result.efectivo += signed;
    else result.transferencia += signed;
  }
  return result;
}

/** Rango `[desde, hasta)` en UTC de un día calendario de Tucumán (constitución, regla 9). */
export function dayRange(dateKey: string): { gte: Date; lt: Date } {
  return { gte: tucumanMidnightUtc(dateKey), lt: tucumanMidnightUtc(addDaysToDateKey(dateKey, 1)) };
}

/**
 * Aclaración para un turno que no empieza y termina el mismo día (specs/014,
 * sección 7): un turno que cruza la medianoche aparece en los dos días.
 */
export function shiftContinuity(
  shift: { openedAt: Date; closedAt: Date | null },
  range: { gte: Date; lt: Date },
): "previous" | "next" | null {
  if (shift.openedAt < range.gte) return "previous";
  if (shift.closedAt === null || shift.closedAt >= range.lt) return "next";
  return null;
}
