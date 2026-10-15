import { describe, expect, it, vi } from "vitest";
import {
  computeEAN13CheckDigit,
  generateBarcodeCandidate,
  generateUniqueBarcode,
  isValidOwnBarcode,
} from "./barcode";

describe("computeEAN13CheckDigit", () => {
  it("calcula bien el dígito verificador (ejemplo real conocido)", () => {
    // 4006381333931 es un EAN-13 real válido (Kinder Chocolate).
    expect(computeEAN13CheckDigit("400638133393")).toBe(1);
  });

  it("tira error si no son 12 dígitos", () => {
    expect(() => computeEAN13CheckDigit("123")).toThrow();
  });
});

describe("generateBarcodeCandidate", () => {
  it("genera 13 dígitos con prefijo 20-29 y verificador correcto", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateBarcodeCandidate();
      expect(code).toMatch(/^\d{13}$/);
      const prefix = Number(code.slice(0, 2));
      expect(prefix).toBeGreaterThanOrEqual(20);
      expect(prefix).toBeLessThanOrEqual(29);
      expect(computeEAN13CheckDigit(code.slice(0, 12))).toBe(Number(code[12]));
    }
  });
});

describe("isValidOwnBarcode", () => {
  it("acepta un código propio bien formado", () => {
    expect(isValidOwnBarcode(generateBarcodeCandidate())).toBe(true);
  });

  it("rechaza longitud incorrecta, prefijo fuera de rango o verificador inválido", () => {
    expect(isValidOwnBarcode("123")).toBe(false);
    expect(isValidOwnBarcode("4006381333931")).toBe(false); // prefijo 40, no es nuestro.
    expect(isValidOwnBarcode("2000000000001")).toBe(false); // verificador a propósito mal.
  });
});

describe("generateUniqueBarcode", () => {
  it("devuelve el primer candidato si no choca con nada", async () => {
    const db = { product: { findUnique: vi.fn().mockResolvedValue(null) } };
    const code = await generateUniqueBarcode(db);
    expect(isValidOwnBarcode(code)).toBe(true);
    expect(db.product.findUnique).toHaveBeenCalledTimes(1);
  });

  it("reintenta si el primer candidato ya existe", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "ya-existe" })
      .mockResolvedValueOnce(null);
    const db = { product: { findUnique } };
    const code = await generateUniqueBarcode(db);
    expect(isValidOwnBarcode(code)).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("tira error si se queda sin intentos", async () => {
    const db = { product: { findUnique: vi.fn().mockResolvedValue({ id: "siempre-existe" }) } };
    await expect(generateUniqueBarcode(db, 3)).rejects.toThrow();
    expect(db.product.findUnique).toHaveBeenCalledTimes(3);
  });
});
