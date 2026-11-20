// SKU del producto (specs/020, RF-1). Funciones puras: se usan en la ficha del
// producto, al vincular y con lo que llega de Mercado Libre.

export const SKU_MAX = 50;

/** Letras sin tilde, números, guion, guion bajo, punto y barra. Sin espacios. */
const ALLOWED = /^[A-Za-z0-9._/-]+$/;

export type SkuResult = { ok: true; sku: string; skuKey: string } | { ok: false; error: string };

/**
 * Valida un SKU y devuelve lo que se guarda: `sku` como lo escribió el usuario
 * (recortado) y `skuKey` en mayúsculas, que es sobre lo que la base garantiza
 * que no se repita sin distinguir mayúsculas.
 */
export function normalizeSku(raw: string): SkuResult {
  const sku = raw.trim();
  if (sku.length === 0) return { ok: false, error: "El SKU no puede estar vacío." };
  if (sku.length > SKU_MAX) return { ok: false, error: `El SKU puede tener hasta ${SKU_MAX} caracteres.` };
  if (/\s/.test(sku)) return { ok: false, error: "El SKU no puede tener espacios." };
  if (!ALLOWED.test(sku)) {
    return {
      ok: false,
      error: "El SKU solo puede tener letras sin tilde, números, guiones, guiones bajos, puntos y barras.",
    };
  }
  return { ok: true, sku, skuKey: skuKeyOf(sku) };
}

/** Forma de comparar dos SKU sin distinguir mayúsculas. */
export function skuKeyOf(sku: string): string {
  return sku.trim().toUpperCase();
}

/**
 * SKU opcional de un formulario: vacío es "sin SKU" (`null`), no un error.
 */
export function normalizeOptionalSku(raw: string | null | undefined): SkuResult | { ok: true; sku: null; skuKey: null } {
  if (raw === null || raw === undefined || raw.trim() === "") return { ok: true, sku: null, skuKey: null };
  return normalizeSku(raw);
}
