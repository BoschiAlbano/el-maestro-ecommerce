const TUCUMAN_TZ = "America/Argentina/Tucuman";

/**
 * Fecha `YYYY-MM-DD` en horario de Tucumán (constitución, regla 9) — para
 * agrupar por día sin el corrimiento que da usar la fecha en UTC.
 */
export function toTucumanDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TUCUMAN_TZ }).format(date);
}

/**
 * Período de comparación: mismo largo que `[from, to]`, desplazado hacia
 * atrás esa misma cantidad de tiempo (specs/011, sección 2) — funciona con
 * cualquier rango, no solo con meses calendario completos.
 */
export function computePreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - durationMs),
    to: new Date(from.getTime()),
  };
}

export function computeTicketPromedio(total: number, count: number): number {
  if (count === 0) return 0;
  return total / count;
}

export function computeMarginSummary(
  items: { unitSalePrice: number; unitCost: number; quantity: number }[],
): { totalMargin: number; marginPct: number } {
  let totalSale = 0;
  let totalMargin = 0;
  for (const item of items) {
    totalSale += item.unitSalePrice * item.quantity;
    totalMargin += (item.unitSalePrice - item.unitCost) * item.quantity;
  }
  const marginPct = totalSale === 0 ? 0 : (totalMargin / totalSale) * 100;
  return { totalMargin, marginPct };
}

export function computeStockValuation(products: { currentStock: number; purchasePrice: number }[]): number {
  return products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);
}

/**
 * Instante UTC de la medianoche de Tucumán para una fecha `YYYY-MM-DD`.
 * Argentina usa UTC-3 fijo (sin horario de verano desde 2009), así que la
 * medianoche de Tucumán es siempre las 03:00 UTC del mismo día calendario.
 */
export function tucumanMidnightUtc(dateKey: string): Date {
  return new Date(`${dateKey}T03:00:00.000Z`);
}

/** Suma (o resta) días a una clave `YYYY-MM-DD`, devolviendo otra clave. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Rango por defecto al abrir las analíticas: desde el día 1 del mes en
 * curso hasta hoy inclusive, en horario de Tucumán.
 */
export function getDefaultDateRange(now: Date): { from: Date; to: Date } {
  const todayKey = toTucumanDateKey(now);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  return {
    from: tucumanMidnightUtc(monthStartKey),
    to: tucumanMidnightUtc(addDaysToDateKey(todayKey, 1)),
  };
}

export type AnalyticsSearchParams = {
  desde?: string;
  hasta?: string;
  empleado?: string;
  producto?: string;
  marca?: string;
  rubro?: string;
  canal?: string;
  medioPago?: string;
};

export type ParsedAnalyticsFilters = {
  from: Date;
  to: Date;
  employeeId?: string;
  productId?: string;
  brandId?: string;
  rubroId?: string;
  channel?: string;
  paymentMethod?: "EFECTIVO" | "TRANSFERENCIA";
};

function orUndefined(value: string | undefined): string | undefined {
  return value && value !== "__all__" ? value : undefined;
}

/**
 * Convierte los `searchParams` de la URL en filtros listos para
 * `loadAnalyticsData` — usado por la pantalla y por las dos exportaciones,
 * para que las tres entiendan el mismo filtro de la misma forma.
 */
export function parseAnalyticsFilters(params: AnalyticsSearchParams, now: Date): ParsedAnalyticsFilters {
  const defaultRange = getDefaultDateRange(now);
  const paymentMethod = params.medioPago === "EFECTIVO" || params.medioPago === "TRANSFERENCIA" ? params.medioPago : undefined;

  return {
    from: params.desde ? tucumanMidnightUtc(params.desde) : defaultRange.from,
    to: params.hasta ? tucumanMidnightUtc(addDaysToDateKey(params.hasta, 1)) : defaultRange.to,
    employeeId: orUndefined(params.empleado),
    productId: orUndefined(params.producto),
    brandId: orUndefined(params.marca),
    rubroId: orUndefined(params.rubro),
    channel: orUndefined(params.canal),
    paymentMethod,
  };
}

/** Agrupador genérico (specs/011, sección 3) — empleado/turno/canal/producto/marca/rubro lo reusan. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
