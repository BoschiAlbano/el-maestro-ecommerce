import { describe, expect, it } from "vitest";
import {
  toTucumanDateKey,
  computePreviousPeriod,
  computeTicketPromedio,
  computeMarginSummary,
  computeStockValuation,
  groupBy,
  tucumanMidnightUtc,
  addDaysToDateKey,
  getDefaultDateRange,
  parseAnalyticsFilters,
} from "./analytics";

describe("toTucumanDateKey", () => {
  it("una hora que ya es el día siguiente en UTC pero no en Tucumán", () => {
    // 2026-01-02T02:00:00Z = 2026-01-01T23:00:00 en Tucumán (UTC-3).
    expect(toTucumanDateKey(new Date("2026-01-02T02:00:00Z"))).toBe("2026-01-01");
  });

  it("una hora que es el mismo día en los dos husos", () => {
    expect(toTucumanDateKey(new Date("2026-01-01T15:00:00Z"))).toBe("2026-01-01");
  });
});

describe("computePreviousPeriod", () => {
  it("desplaza hacia atrás el mismo largo del rango", () => {
    // Febrero 2026 tiene 28 días (no es bisiesto): el período anterior
    // dura lo mismo, no necesariamente coincide con el mes calendario.
    const from = new Date("2026-02-01T00:00:00Z");
    const to = new Date("2026-03-01T00:00:00Z");
    const prev = computePreviousPeriod(from, to);
    expect(prev.to).toEqual(from);
    expect(prev.from).toEqual(new Date("2026-01-04T00:00:00Z"));
  });

  it("funciona con un rango corto (una semana)", () => {
    const from = new Date("2026-02-08T00:00:00Z");
    const to = new Date("2026-02-15T00:00:00Z");
    const prev = computePreviousPeriod(from, to);
    expect(prev.from).toEqual(new Date("2026-02-01T00:00:00Z"));
    expect(prev.to).toEqual(from);
  });
});

describe("computeTicketPromedio", () => {
  it("divide total entre cantidad", () => {
    expect(computeTicketPromedio(1000, 4)).toBe(250);
  });

  it("devuelve 0 sin ninguna venta, no NaN", () => {
    expect(computeTicketPromedio(0, 0)).toBe(0);
  });
});

describe("computeMarginSummary", () => {
  it("calcula el margen total y el porcentaje", () => {
    const result = computeMarginSummary([
      { unitSalePrice: 100, unitCost: 60, quantity: 2 },
      { unitSalePrice: 50, unitCost: 50, quantity: 1 },
    ]);
    expect(result.totalMargin).toBe(80);
    expect(result.marginPct).toBeCloseTo(32, 5);
  });

  it("sin ítems, no divide por cero", () => {
    expect(computeMarginSummary([])).toEqual({ totalMargin: 0, marginPct: 0 });
  });
});

describe("computeStockValuation", () => {
  it("suma stock por costo de cada producto", () => {
    expect(
      computeStockValuation([
        { currentStock: 10, purchasePrice: 100 },
        { currentStock: 5, purchasePrice: 200 },
      ]),
    ).toBe(2000);
  });
});

describe("tucumanMidnightUtc", () => {
  it("la medianoche de Tucumán son las 03:00 UTC del mismo día", () => {
    expect(tucumanMidnightUtc("2026-10-17")).toEqual(new Date("2026-10-17T03:00:00.000Z"));
  });
});

describe("addDaysToDateKey", () => {
  it("suma días cruzando de mes", () => {
    expect(addDaysToDateKey("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("resta días cruzando de año", () => {
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("getDefaultDateRange", () => {
  it("desde el día 1 del mes en curso hasta mañana (Tucumán), exclusivo", () => {
    // 2026-10-17T20:00:00Z = 2026-10-17T17:00:00 en Tucumán.
    const range = getDefaultDateRange(new Date("2026-10-17T20:00:00Z"));
    expect(range.from).toEqual(new Date("2026-10-01T03:00:00.000Z"));
    expect(range.to).toEqual(new Date("2026-10-18T03:00:00.000Z"));
  });

  it("una hora que en UTC ya es el día siguiente, pero no en Tucumán", () => {
    // 2026-11-01T02:00:00Z = 2026-10-31T23:00:00 en Tucumán: sigue en octubre.
    const range = getDefaultDateRange(new Date("2026-11-01T02:00:00Z"));
    expect(range.from).toEqual(new Date("2026-10-01T03:00:00.000Z"));
    expect(range.to).toEqual(new Date("2026-11-01T03:00:00.000Z"));
  });
});

describe("parseAnalyticsFilters", () => {
  const now = new Date("2026-10-17T20:00:00Z");

  it("sin parámetros, usa el rango por defecto y nada más", () => {
    expect(parseAnalyticsFilters({}, now)).toEqual({
      from: new Date("2026-10-01T03:00:00.000Z"),
      to: new Date("2026-10-18T03:00:00.000Z"),
      employeeId: undefined,
      productId: undefined,
      brandId: undefined,
      rubroId: undefined,
      channel: undefined,
      paymentMethod: undefined,
    });
  });

  it("fechas custom: 'hasta' incluye todo ese día", () => {
    const result = parseAnalyticsFilters({ desde: "2026-01-05", hasta: "2026-01-10" }, now);
    expect(result.from).toEqual(new Date("2026-01-05T03:00:00.000Z"));
    expect(result.to).toEqual(new Date("2026-01-11T03:00:00.000Z"));
  });

  it("el sentinel __all__ se trata como sin filtro", () => {
    const result = parseAnalyticsFilters({ empleado: "__all__", marca: "abc" }, now);
    expect(result.employeeId).toBeUndefined();
    expect(result.brandId).toBe("abc");
  });

  it("medio de pago inválido se ignora", () => {
    expect(parseAnalyticsFilters({ medioPago: "QR" }, now).paymentMethod).toBeUndefined();
    expect(parseAnalyticsFilters({ medioPago: "EFECTIVO" }, now).paymentMethod).toBe("EFECTIVO");
  });
});

describe("groupBy", () => {
  it("agrupa por la clave dada", () => {
    const groups = groupBy(
      [
        { tipo: "a", valor: 1 },
        { tipo: "b", valor: 2 },
        { tipo: "a", valor: 3 },
      ],
      (i) => i.tipo,
    );
    expect(groups.get("a")?.length).toBe(2);
    expect(groups.get("b")?.length).toBe(1);
  });
});
