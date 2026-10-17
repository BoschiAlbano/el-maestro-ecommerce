import { describe, expect, it } from "vitest";
import { computeSaleTotal, validatePayments } from "./sale";

describe("computeSaleTotal", () => {
  it("suma cantidad por precio de cada ítem", () => {
    expect(
      computeSaleTotal([
        { quantity: 2, unitSalePrice: 1000 },
        { quantity: 1, unitSalePrice: 500 },
      ]),
    ).toBe(2500);
  });

  it("redondea al peso (constitución, regla 6)", () => {
    expect(computeSaleTotal([{ quantity: 1, unitSalePrice: 100.5 }])).toBe(101);
    expect(computeSaleTotal([{ quantity: 3, unitSalePrice: 33.33 }])).toBe(100);
  });

  it("da cero con un carrito vacío", () => {
    expect(computeSaleTotal([])).toBe(0);
  });
});

describe("validatePayments", () => {
  it("acepta cuando la suma coincide exacto con el total", () => {
    expect(validatePayments(1000, [{ amount: 600 }, { amount: 400 }])).toBe(true);
  });

  it("rechaza si suman de menos", () => {
    expect(validatePayments(1000, [{ amount: 900 }])).toBe(false);
  });

  it("rechaza si suman de más", () => {
    expect(validatePayments(1000, [{ amount: 1100 }])).toBe(false);
  });

  it("rechaza una lista vacía de pagos contra un total mayor a cero", () => {
    expect(validatePayments(1000, [])).toBe(false);
  });

  it("acepta un total cero sin pagos (caso límite, no debería pasar en la práctica)", () => {
    expect(validatePayments(0, [])).toBe(true);
  });
});
