import { describe, expect, it } from "vitest";
import { computeChange, computePaymentStatus, computeSaleTotal, validatePayments } from "./sale";

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

describe("computePaymentStatus", () => {
  it("completo cuando los pagos suman el total", () => {
    expect(computePaymentStatus(2500, [{ amount: 1500 }, { amount: 1000 }])).toEqual({
      paid: 2500,
      remaining: 0,
      status: "complete",
    });
  });

  it("falta cuando los pagos no alcanzan", () => {
    expect(computePaymentStatus(2500, [{ amount: 1000 }])).toEqual({ paid: 1000, remaining: 1500, status: "missing" });
  });

  it("sobra cuando los pagos pasan el total", () => {
    expect(computePaymentStatus(2500, [{ amount: 3000 }])).toEqual({ paid: 3000, remaining: -500, status: "excess" });
  });

  it("sin pagos falta el total completo", () => {
    expect(computePaymentStatus(800, [])).toEqual({ paid: 0, remaining: 800, status: "missing" });
  });
});

describe("computeChange", () => {
  it("devuelve la diferencia entre lo recibido y lo cobrado en efectivo", () => {
    expect(computeChange(5000, 3200)).toBe(1800);
  });

  it("es cero si recibió justo", () => {
    expect(computeChange(3200, 3200)).toBe(0);
  });

  it("nunca es negativo: si recibió de menos no hay vuelto", () => {
    expect(computeChange(1000, 3200)).toBe(0);
  });
});
