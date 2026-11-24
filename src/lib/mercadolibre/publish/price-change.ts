// El precio de venta cambiado desde el formulario de publicación (specs/025,
// RF-4b; plan sección 7). Es el mismo precio del producto (spec 020): esto solo
// decide si hay cambio y si se puede aplicar. Pura; montos en `Decimal`
// (constitución, regla 6).
import Decimal from "decimal.js";

export type PriceChange =
  /** No se mandó precio, o es el mismo. */
  | { kind: "none" }
  | { kind: "change"; value: string }
  | { kind: "invalid"; message: string }
  /** Cambió, pero el usuario no tiene «cambiar precios». */
  | { kind: "denied"; message: string };

/** Pesos con hasta dos decimales; acepta coma o punto. */
export function parsePrice(raw: string): Decimal | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const value = new Decimal(text);
  return value.greaterThan(0) ? value : null;
}

export function salePriceChange(current: string, submitted: string | null | undefined, canChangePrice: boolean): PriceChange {
  if (submitted === null || submitted === undefined || submitted.trim() === "") return { kind: "none" };
  const value = parsePrice(submitted);
  if (!value) return { kind: "invalid", message: "El precio de venta no es válido: un número mayor que cero, con hasta dos decimales." };
  if (value.equals(new Decimal(current))) return { kind: "none" };
  if (!canChangePrice) return { kind: "denied", message: "No tenés permiso para cambiar el precio de venta." };
  return { kind: "change", value: value.toFixed(2) };
}
