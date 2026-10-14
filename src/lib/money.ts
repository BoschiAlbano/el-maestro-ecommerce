import Decimal from "decimal.js";

/**
 * Redondea un monto al peso entero, hacia arriba desde 0,50 (constitución,
 * regla 6). Ej: 100,49 -> 100; 100,50 -> 101; 100,51 -> 101.
 */
export function roundToPeso(amount: Decimal.Value): number {
  return new Decimal(amount).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}
