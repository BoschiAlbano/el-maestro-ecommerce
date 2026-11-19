import { describe, expect, it } from "vitest";
import { normalizeOptionalSku, normalizeSku, skuKeyOf, SKU_MAX } from "./sku";

describe("normalizeSku", () => {
  it.each(["ODOO-TEST-001", "abc_12", "CAB.USB/C", "A", "x".repeat(SKU_MAX)])("acepta %s", (raw) => {
    const result = normalizeSku(raw);
    expect(result.ok).toBe(true);
  });

  it("recorta los espacios de los costados y guarda como se escribió", () => {
    expect(normalizeSku("  odoo-test-001 ")).toEqual({ ok: true, sku: "odoo-test-001", skuKey: "ODOO-TEST-001" });
  });

  it("la clave es la misma sin importar las mayúsculas", () => {
    const a = normalizeSku("odoo-test-001");
    const b = normalizeSku("ODOO-TEST-001");
    expect(a.ok && b.ok && a.skuKey === b.skuKey).toBe(true);
    expect(skuKeyOf(" Odoo-Test-001 ")).toBe("ODOO-TEST-001");
  });

  it("rechaza espacios en el medio", () => {
    expect(normalizeSku("CABLE USB")).toEqual({ ok: false, error: "El SKU no puede tener espacios." });
  });

  it("rechaza vacío", () => {
    expect(normalizeSku("   ").ok).toBe(false);
  });

  it("rechaza más del largo máximo", () => {
    expect(normalizeSku("x".repeat(SKU_MAX + 1))).toEqual({
      ok: false,
      error: `El SKU puede tener hasta ${SKU_MAX} caracteres.`,
    });
  });

  it.each(["CAÑO-1", "ABC#1", "ABC+1", "PRECIO$"])("rechaza caracteres fuera de lo permitido: %s", (raw) => {
    expect(normalizeSku(raw).ok).toBe(false);
  });
});

describe("normalizeOptionalSku", () => {
  it.each([null, undefined, "", "   "])("vacío es sin SKU (%s)", (raw) => {
    expect(normalizeOptionalSku(raw)).toEqual({ ok: true, sku: null, skuKey: null });
  });

  it("con texto valida igual que normalizeSku", () => {
    expect(normalizeOptionalSku("abc-1")).toEqual({ ok: true, sku: "abc-1", skuKey: "ABC-1" });
    expect(normalizeOptionalSku("a b").ok).toBe(false);
  });
});
