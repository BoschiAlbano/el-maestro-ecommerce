// Fechas fiscales (specs/023). La fecha de un comprobante es la del día en
// Tucumán, no la del servidor ni la UTC (constitución, regla 9): una venta a
// las 22:00 de Tucumán es del mismo día, aunque en UTC ya sea el siguiente.

const TUCUMAN_TZ = "America/Argentina/Tucuman";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Día en Tucumán, como "AAAA-MM-DD". */
export function fiscalDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TUCUMAN_TZ }).format(date);
}

/**
 * Una fecha SIN hora (la de un comprobante), guardada como medianoche UTC: es
 * lo que devuelve una columna `@db.Date`. Se lee con las partes UTC. Pasarla
 * por `fiscalDate` la correría un día atrás, porque Tucumán está 3 horas
 * detrás de UTC y la medianoche UTC es la noche del día anterior allá.
 *
 * Regla: un MOMENTO (`new Date()`) se convierte con `fiscalDate`; una FECHA
 * SIN HORA que viene de la base se lee con `dateOnly`.
 */
export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Días de calendario, en Tucumán, entre dos momentos. Negativo si `to` es anterior. */
export function fiscalDaysBetween(from: Date, to: Date): number {
  const start = Date.parse(`${fiscalDate(from)}T00:00:00Z`);
  const end = Date.parse(`${fiscalDate(to)}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS);
}

/** El mismo día en Tucumán, un año antes: inicio de "los últimos 12 meses". */
export function oneYearBefore(date: Date): string {
  const [year, month, day] = fiscalDate(date).split("-").map(Number);
  // El 29 de febrero no existe el año anterior: se toma el 28.
  const safeDay = month === 2 && day === 29 ? 28 : day;
  return `${year - 1}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}
