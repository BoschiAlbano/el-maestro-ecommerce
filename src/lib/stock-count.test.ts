import { describe, expect, it } from "vitest";
import { computeCountAdjustments, type ProductStock } from "./stock-count";

const products: ProductStock[] = [
  { id: "a", name: "Producto A", currentStock: 10 },
  { id: "b", name: "Producto B", currentStock: 0 },
  { id: "c", name: "Producto C", currentStock: 5 },
];

describe("computeCountAdjustments", () => {
  it("no devuelve nada si lo contado coincide con lo registrado", () => {
    const result = computeCountAdjustments(products, { a: 10, b: 0, c: 5 });
    expect(result).toEqual([]);
  });

  it("devuelve solo los productos con diferencia real", () => {
    const result = computeCountAdjustments(products, { a: 10, b: 3, c: 5 });
    expect(result).toEqual([
      { productId: "b", productName: "Producto B", registered: 0, counted: 3, delta: 3 },
    ]);
  });

  it("calcula el delta con signo (puede ser negativo)", () => {
    const result = computeCountAdjustments(products, { a: 7 });
    expect(result).toEqual([
      { productId: "a", productName: "Producto A", registered: 10, counted: 7, delta: -3 },
    ]);
  });

  it("ignora productos no contados, no los trata como cero", () => {
    const result = computeCountAdjustments(products, { a: 10 });
    expect(result).toEqual([]);
  });

  it("detecta una carga inicial: todo en cero registrado, todo contado de verdad", () => {
    const uncounted: ProductStock[] = [
      { id: "a", name: "Producto A", currentStock: 0 },
      { id: "b", name: "Producto B", currentStock: 0 },
    ];
    const result = computeCountAdjustments(uncounted, { a: 20, b: 0 });
    expect(result).toEqual([
      { productId: "a", productName: "Producto A", registered: 0, counted: 20, delta: 20 },
    ]);
  });
});
