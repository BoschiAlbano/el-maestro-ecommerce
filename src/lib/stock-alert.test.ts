import { describe, expect, it } from "vitest";
import { isStockAlertActive, stillDismissed } from "./stock-alert";

describe("isStockAlertActive", () => {
  it("no hay aviso si no hay productos bajo el mínimo", () => {
    expect(isStockAlertActive([], [])).toBe(false);
    expect(isStockAlertActive([], ["a"])).toBe(false);
  });

  it("hay aviso si hay productos bajos y nada se marcó como leído", () => {
    expect(isStockAlertActive(["a", "b"], [])).toBe(true);
  });

  it("queda oculto si todos los productos bajos ya estaban marcados como leídos", () => {
    expect(isStockAlertActive(["a", "b"], ["a", "b"])).toBe(false);
    expect(isStockAlertActive(["a"], ["a", "b"])).toBe(false);
  });

  it("vuelve a aparecer si un producto nuevo queda bajo el mínimo", () => {
    expect(isStockAlertActive(["a", "c"], ["a", "b"])).toBe(true);
  });
});

describe("stillDismissed", () => {
  it("conserva solo los productos que siguen bajo el mínimo", () => {
    expect(stillDismissed(["a"], ["a", "b"])).toEqual(["a"]);
    expect(stillDismissed([], ["a", "b"])).toEqual([]);
  });

  it("un producto repuesto y que vuelve a bajar se considera nuevo", () => {
    // Se marcó leído con "a" bajo; se repone ("a" sale de la lista) y se poda...
    const afterRestock = stillDismissed([], ["a"]);
    // ...cuando vuelve a bajar, el aviso reaparece.
    expect(isStockAlertActive(["a"], afterRestock)).toBe(true);
  });
});
