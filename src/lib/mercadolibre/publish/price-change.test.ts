import { describe, expect, it } from "vitest";
import { parsePrice, salePriceChange } from "./price-change";

describe("salePriceChange (specs/025, RF-4b)", () => {
  it("sin precio o con el mismo, no hay cambio", () => {
    expect(salePriceChange("9500", null, true)).toEqual({ kind: "none" });
    expect(salePriceChange("9500", "  ", true)).toEqual({ kind: "none" });
    expect(salePriceChange("9500.00", "9500", true)).toEqual({ kind: "none" });
  });

  it("un precio nuevo se aplica con el permiso", () => {
    expect(salePriceChange("9500", "10200,50", true)).toEqual({ kind: "change", value: "10200.50" });
  });

  it("sin el permiso «cambiar precios» se rechaza; con el mismo precio, no hace falta permiso", () => {
    expect(salePriceChange("9500", "10200", false).kind).toBe("denied");
    expect(salePriceChange("9500", "9500", false)).toEqual({ kind: "none" });
  });

  it("precios inválidos", () => {
    for (const raw of ["0", "-5", "abc", "10.555", "1e5"]) expect(salePriceChange("9500", raw, true).kind).toBe("invalid");
  });

  it("parsePrice", () => {
    expect(parsePrice("12.345,6")).toBeNull();
    expect(parsePrice("7500")?.toFixed(2)).toBe("7500.00");
  });
});
