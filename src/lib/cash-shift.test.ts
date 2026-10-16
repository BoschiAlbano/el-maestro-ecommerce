import { describe, expect, it } from "vitest";
import { computeExpectedCash, type CashMovementForExpected } from "./cash-shift";

describe("computeExpectedCash", () => {
  it("devuelve el monto inicial si no hay movimientos", () => {
    expect(computeExpectedCash(1000, [])).toBe(1000);
  });

  it("suma los ingresos en efectivo", () => {
    const movements: CashMovementForExpected[] = [
      { type: "INGRESO", amount: 500, paymentMethod: "EFECTIVO" },
    ];
    expect(computeExpectedCash(1000, movements)).toBe(1500);
  });

  it("resta los egresos en efectivo", () => {
    const movements: CashMovementForExpected[] = [
      { type: "EGRESO", amount: 300, paymentMethod: "EFECTIVO" },
    ];
    expect(computeExpectedCash(1000, movements)).toBe(700);
  });

  it("ignora los movimientos por transferencia", () => {
    const movements: CashMovementForExpected[] = [
      { type: "INGRESO", amount: 5000, paymentMethod: "TRANSFERENCIA" },
    ];
    expect(computeExpectedCash(1000, movements)).toBe(1000);
  });

  it("combina varios movimientos de los dos tipos y medios", () => {
    const movements: CashMovementForExpected[] = [
      { type: "INGRESO", amount: 500, paymentMethod: "EFECTIVO" },
      { type: "INGRESO", amount: 2000, paymentMethod: "TRANSFERENCIA" },
      { type: "EGRESO", amount: 200, paymentMethod: "EFECTIVO" },
      { type: "EGRESO", amount: 1000, paymentMethod: "TRANSFERENCIA" },
    ];
    expect(computeExpectedCash(1000, movements)).toBe(1300);
  });
});
