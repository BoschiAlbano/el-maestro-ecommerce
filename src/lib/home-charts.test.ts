import { describe, expect, it } from "vitest";
import { topProductsByQuantity } from "./home-charts";

const item = (productId: string, productName: string, quantity: number, unitSalePrice: number) => ({
  productId,
  productName,
  quantity,
  unitSalePrice,
});

describe("topProductsByQuantity", () => {
  it("sin ventas no hay productos", () => {
    expect(topProductsByQuantity([])).toEqual([]);
  });

  it("suma las unidades y el importe de un mismo producto en distintas ventas", () => {
    const result = topProductsByQuantity([item("a", "Cable", 2, 1000), item("a", "Cable", 3, 1000)]);
    expect(result).toEqual([{ key: "a", label: "Cable", cantidad: 5, total: 5000 }]);
  });

  it("ordena por unidades, de mayor a menor", () => {
    const result = topProductsByQuantity([item("a", "Cable", 1, 1000), item("b", "Funda", 4, 500), item("c", "Vidrio", 2, 800)]);
    expect(result.map((p) => p.key)).toEqual(["b", "c", "a"]);
  });

  it("corta en el límite pedido (5 por defecto)", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => item(id, id.toUpperCase(), 10 - i, 100));
    expect(topProductsByQuantity(items)).toHaveLength(5);
    expect(topProductsByQuantity(items, 3).map((p) => p.key)).toEqual(["a", "b", "c"]);
  });

  it("ante igual cantidad gana el de mayor importe, y después el nombre", () => {
    const result = topProductsByQuantity([item("a", "Zeta", 2, 100), item("b", "Beta", 2, 500), item("c", "Alfa", 2, 100)]);
    expect(result.map((p) => p.key)).toEqual(["b", "c", "a"]);
  });
});
