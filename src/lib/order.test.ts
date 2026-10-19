import { describe, expect, it } from "vitest";
import { computeDepositApplication, computeCommittedQuantities, validateOrderItemQuantity } from "./order";

describe("computeDepositApplication", () => {
  it("la seña cubre todo (sobra)", () => {
    expect(computeDepositApplication(1000, 600)).toEqual({ depositApplied: 600, amountToCollect: 0 });
  });

  it("la seña cubre solo una parte", () => {
    expect(computeDepositApplication(300, 1000)).toEqual({ depositApplied: 300, amountToCollect: 700 });
  });

  it("no hay seña (0)", () => {
    expect(computeDepositApplication(0, 500)).toEqual({ depositApplied: 0, amountToCollect: 500 });
  });

  it("la seña cubre exacto el total", () => {
    expect(computeDepositApplication(500, 500)).toEqual({ depositApplied: 500, amountToCollect: 0 });
  });
});

describe("computeCommittedQuantities", () => {
  it("suma lo pendiente por producto", () => {
    const result = computeCommittedQuantities([
      { productId: "a", quantityOrdered: 5, quantityDelivered: 0 },
      { productId: "a", quantityOrdered: 3, quantityDelivered: 1 },
      { productId: "b", quantityOrdered: 2, quantityDelivered: 0 },
    ]);
    expect(result.get("a")).toBe(7);
    expect(result.get("b")).toBe(2);
  });

  it("ignora líneas ya completas", () => {
    const result = computeCommittedQuantities([
      { productId: "a", quantityOrdered: 5, quantityDelivered: 5 },
    ]);
    expect(result.has("a")).toBe(false);
  });

  it("devuelve vacío sin ítems", () => {
    expect(computeCommittedQuantities([]).size).toBe(0);
  });
});

describe("validateOrderItemQuantity", () => {
  it("acepta una cantidad entera mayor a lo entregado", () => {
    expect(validateOrderItemQuantity(5, 2)).toBeNull();
  });

  it("acepta justo lo entregado", () => {
    expect(validateOrderItemQuantity(3, 3)).toBeNull();
  });

  it("rechaza menos de lo entregado", () => {
    expect(validateOrderItemQuantity(2, 3)).toContain("Ya se entregaron 3");
  });

  it("rechaza cero, negativos y decimales", () => {
    expect(validateOrderItemQuantity(0, 0)).not.toBeNull();
    expect(validateOrderItemQuantity(-1, 0)).not.toBeNull();
    expect(validateOrderItemQuantity(1.5, 0)).not.toBeNull();
  });
});
