import { describe, expect, it } from "vitest";
import { computeExpectedCash, summarizeShift, type CashMovementForExpected } from "./cash-shift";

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

describe("summarizeShift", () => {
  it("sin movimientos, el esperado es el inicial y todo lo demás cero", () => {
    expect(summarizeShift(1000, [])).toEqual({
      expectedCash: 1000,
      ingresos: 0,
      egresos: 0,
      efectivo: { ingresos: 0, egresos: 0, neto: 0 },
      transferencia: { ingresos: 0, egresos: 0, neto: 0 },
    });
  });

  it("separa efectivo y transferencia, y solo el efectivo mueve el esperado", () => {
    const movements: CashMovementForExpected[] = [
      { type: "INGRESO", amount: 500, paymentMethod: "EFECTIVO" },
      { type: "EGRESO", amount: 200, paymentMethod: "EFECTIVO" },
      { type: "INGRESO", amount: 900, paymentMethod: "TRANSFERENCIA" },
      { type: "EGRESO", amount: 100, paymentMethod: "TRANSFERENCIA" },
    ];
    const summary = summarizeShift(1000, movements);
    expect(summary.expectedCash).toBe(1300);
    expect(summary.ingresos).toBe(1400);
    expect(summary.egresos).toBe(300);
    expect(summary.efectivo).toEqual({ ingresos: 500, egresos: 200, neto: 300 });
    expect(summary.transferencia).toEqual({ ingresos: 900, egresos: 100, neto: 800 });
  });

  it("el esperado coincide con computeExpectedCash", () => {
    const movements: CashMovementForExpected[] = [
      { type: "INGRESO", amount: 250, paymentMethod: "EFECTIVO" },
      { type: "EGRESO", amount: 80, paymentMethod: "EFECTIVO" },
    ];
    expect(summarizeShift(400, movements).expectedCash).toBe(computeExpectedCash(400, movements));
  });
});
