import { describe, expect, it } from "vitest";
import { parseSalesPeriod, salesPeriodRange } from "./sales-history";

describe("parseSalesPeriod", () => {
  it("por defecto es la caja actual si hay una abierta", () => {
    expect(parseSalesPeriod(undefined, true)).toBe("turno");
  });

  it("sin caja abierta el valor por defecto es hoy", () => {
    expect(parseSalesPeriod(undefined, false)).toBe("hoy");
  });

  it("acepta los períodos válidos", () => {
    expect(parseSalesPeriod("hoy", true)).toBe("hoy");
    expect(parseSalesPeriod("7dias", false)).toBe("7dias");
    expect(parseSalesPeriod("todas", true)).toBe("todas");
  });

  it("pedir la caja actual sin caja abierta cae en hoy", () => {
    expect(parseSalesPeriod("turno", false)).toBe("hoy");
  });

  it("un valor inválido usa el valor por defecto", () => {
    expect(parseSalesPeriod("cualquier-cosa", true)).toBe("turno");
    expect(parseSalesPeriod("cualquier-cosa", false)).toBe("hoy");
  });
});

describe("salesPeriodRange", () => {
  // 19/10/2026 18:00 en Tucumán = 21:00 UTC.
  const now = new Date("2026-10-19T21:00:00.000Z");

  it("hoy va de la medianoche de Tucumán a la de mañana", () => {
    expect(salesPeriodRange("hoy", now)).toEqual({
      from: new Date("2026-10-19T03:00:00.000Z"),
      to: new Date("2026-10-20T03:00:00.000Z"),
    });
  });

  it("7 días incluye hoy y los 6 anteriores", () => {
    expect(salesPeriodRange("7dias", now)).toEqual({
      from: new Date("2026-10-13T03:00:00.000Z"),
      to: new Date("2026-10-20T03:00:00.000Z"),
    });
  });

  it("a la 01:00 de Tucumán (04:00 UTC) todavía es el mismo día de Tucumán", () => {
    const lateNight = new Date("2026-10-20T01:00:00.000Z"); // 22:00 del 19 en Tucumán
    expect(salesPeriodRange("hoy", lateNight)?.from).toEqual(new Date("2026-10-19T03:00:00.000Z"));
  });

  it("la caja actual y todas no tienen rango por fecha", () => {
    expect(salesPeriodRange("turno", now)).toBeNull();
    expect(salesPeriodRange("todas", now)).toBeNull();
  });
});
