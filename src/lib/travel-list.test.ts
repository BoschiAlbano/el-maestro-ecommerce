import { describe, expect, it } from "vitest";
import { computeTravelList } from "./travel-list";

describe("computeTravelList", () => {
  it("un producto por encima del mínimo no entra", () => {
    const result = computeTravelList(
      [{ id: "a", name: "Producto A", currentStock: 10, minStock: 5 }],
      new Map(),
    );
    expect(result).toEqual([]);
  });

  it("por debajo del mínimo sin nada comprometido", () => {
    const result = computeTravelList(
      [{ id: "a", name: "Producto A", currentStock: 2, minStock: 5 }],
      new Map(),
    );
    expect(result).toEqual([
      { id: "a", name: "Producto A", stock: 2, minStock: 5, committed: 0, available: 2, suggested: 3 },
    ]);
  });

  it("lo comprometido empuja el disponible por debajo del mínimo", () => {
    const result = computeTravelList(
      [{ id: "a", name: "Producto A", currentStock: 10, minStock: 5 }],
      new Map([["a", 8]]),
    );
    expect(result).toEqual([
      { id: "a", name: "Producto A", stock: 10, minStock: 5, committed: 8, available: 2, suggested: 3 },
    ]);
  });

  it("disponible negativo: la sugerida es más alta, sin tope", () => {
    const result = computeTravelList(
      [{ id: "a", name: "Producto A", currentStock: 5, minStock: 5 }],
      new Map([["a", 12]]),
    );
    expect(result).toEqual([
      { id: "a", name: "Producto A", stock: 5, minStock: 5, committed: 12, available: -7, suggested: 12 },
    ]);
  });

  it("disponible justo igual al mínimo no entra", () => {
    const result = computeTravelList(
      [{ id: "a", name: "Producto A", currentStock: 5, minStock: 5 }],
      new Map(),
    );
    expect(result).toEqual([]);
  });
});
