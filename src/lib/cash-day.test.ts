import { describe, expect, it } from "vitest";
import { collectedBySales, dayRange, parseDayKey, shiftContinuity, summarizeDay, summarizeSales } from "./cash-day";

describe("parseDayKey", () => {
  const today = "2026-10-20";

  it("devuelve hoy si no hay fecha", () => {
    expect(parseDayKey(undefined, today)).toBe(today);
  });

  it("acepta una fecha pasada", () => {
    expect(parseDayKey("2026-10-01", today)).toBe("2026-10-01");
  });

  it("acepta hoy", () => {
    expect(parseDayKey(today, today)).toBe(today);
  });

  it("vuelve a hoy con una fecha futura", () => {
    expect(parseDayKey("2026-10-21", today)).toBe(today);
  });

  it("vuelve a hoy con un formato inválido", () => {
    expect(parseDayKey("ayer", today)).toBe(today);
    expect(parseDayKey("20-10-2026", today)).toBe(today);
  });

  it("vuelve a hoy con una fecha que no existe", () => {
    expect(parseDayKey("2026-02-31", today)).toBe(today);
  });
});

describe("summarizeDay", () => {
  it("no suma montos iniciales: el efectivo esperado es el neto del día", () => {
    const summary = summarizeDay([
      { type: "INGRESO", amount: 1000, paymentMethod: "EFECTIVO" },
      { type: "EGRESO", amount: 200, paymentMethod: "EFECTIVO" },
    ]);
    expect(summary.expectedCash).toBe(800);
    expect(summary.efectivo).toEqual({ ingresos: 1000, egresos: 200, neto: 800 });
  });

  it("separa efectivo de transferencia y suma los dos en los totales", () => {
    const summary = summarizeDay([
      { type: "INGRESO", amount: 1000, paymentMethod: "EFECTIVO" },
      { type: "INGRESO", amount: 3000, paymentMethod: "TRANSFERENCIA" },
      { type: "EGRESO", amount: 500, paymentMethod: "TRANSFERENCIA" },
    ]);
    expect(summary.transferencia.neto).toBe(2500);
    expect(summary.expectedCash).toBe(1000);
    expect(summary.ingresos).toBe(4000);
    expect(summary.egresos).toBe(500);
  });

  it("un día sin movimientos da todo en cero", () => {
    const summary = summarizeDay([]);
    expect(summary.expectedCash).toBe(0);
    expect(summary.ingresos).toBe(0);
    expect(summary.egresos).toBe(0);
  });
});

describe("summarizeSales", () => {
  it("separa las ventas activas de las anuladas", () => {
    expect(
      summarizeSales([
        { total: 1000, voided: false },
        { total: 2500, voided: false },
        { total: 700, voided: true },
      ]),
    ).toEqual({ count: 2, total: 3500, voidedCount: 1, voidedTotal: 700 });
  });

  it("sin ventas devuelve ceros", () => {
    expect(summarizeSales([])).toEqual({ count: 0, total: 0, voidedCount: 0, voidedTotal: 0 });
  });
});

describe("collectedBySales", () => {
  it("cuenta solo los movimientos que vienen de una venta, por medio de pago", () => {
    expect(
      collectedBySales([
        { type: "INGRESO", amount: 1000, paymentMethod: "EFECTIVO", saleId: "v1" },
        { type: "INGRESO", amount: 2000, paymentMethod: "TRANSFERENCIA", saleId: "v1" },
        { type: "INGRESO", amount: 500, paymentMethod: "EFECTIVO", saleId: null }, // manual o seña
      ]),
    ).toEqual({ efectivo: 1000, transferencia: 2000 });
  });

  it("descuenta la devolución de una venta anulada", () => {
    expect(
      collectedBySales([
        { type: "INGRESO", amount: 1500, paymentMethod: "EFECTIVO", saleId: "v1" },
        { type: "EGRESO", amount: 1500, paymentMethod: "EFECTIVO", saleId: "v1" },
        { type: "INGRESO", amount: 800, paymentMethod: "TRANSFERENCIA", saleId: "v2" },
      ]),
    ).toEqual({ efectivo: 0, transferencia: 800 });
  });
});

describe("dayRange", () => {
  const range = dayRange("2026-10-20");

  it("empieza a la medianoche de Tucumán (03:00 UTC) y dura 24 horas", () => {
    expect(range.gte.toISOString()).toBe("2026-10-20T03:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-10-21T03:00:00.000Z");
  });

  it("una venta a las 23:30 de Tucumán todavía es del mismo día", () => {
    const at = new Date("2026-10-21T02:30:00.000Z"); // 23:30 del 20/10 en Tucumán
    expect(at >= range.gte && at < range.lt).toBe(true);
  });

  it("a la medianoche de Tucumán ya es del día siguiente", () => {
    const at = new Date("2026-10-21T03:00:00.000Z"); // 00:00 del 21/10
    expect(at < range.lt).toBe(false);
  });

  it("una venta a las 00:30 de Tucumán no es del día anterior", () => {
    const at = new Date("2026-10-20T03:30:00.000Z"); // 00:30 del 20/10
    expect(at >= range.gte).toBe(true);
  });

  it("cruza bien el fin de mes", () => {
    expect(dayRange("2026-10-31").lt.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("shiftContinuity", () => {
  const range = dayRange("2026-10-20");
  const at = (iso: string) => new Date(iso);

  it("un turno que abre y cierra el mismo día no tiene aclaración", () => {
    expect(
      shiftContinuity({ openedAt: at("2026-10-20T12:00:00Z"), closedAt: at("2026-10-20T20:00:00Z") }, range),
    ).toBeNull();
  });

  it("un turno abierto el día anterior viene del día anterior", () => {
    expect(
      shiftContinuity({ openedAt: at("2026-10-19T20:00:00Z"), closedAt: at("2026-10-20T10:00:00Z") }, range),
    ).toBe("previous");
  });

  it("un turno que cierra al día siguiente sigue el día siguiente", () => {
    expect(
      shiftContinuity({ openedAt: at("2026-10-20T20:00:00Z"), closedAt: at("2026-10-21T10:00:00Z") }, range),
    ).toBe("next");
  });

  it("un turno todavía abierto sigue el día siguiente", () => {
    expect(shiftContinuity({ openedAt: at("2026-10-20T12:00:00Z"), closedAt: null }, range)).toBe("next");
  });
});

describe("totales del día con dos turnos", () => {
  it("suman los dos turnos sin contar los montos iniciales", () => {
    const manana = [
      { type: "INGRESO" as const, amount: 5000, paymentMethod: "EFECTIVO" as const, saleId: "v1" },
      { type: "INGRESO" as const, amount: 2000, paymentMethod: "TRANSFERENCIA" as const, saleId: "v2" },
    ];
    const tarde = [
      { type: "INGRESO" as const, amount: 3000, paymentMethod: "EFECTIVO" as const, saleId: "v3" },
      { type: "EGRESO" as const, amount: 1000, paymentMethod: "EFECTIVO" as const, saleId: null },
    ];
    const day = summarizeDay([...manana, ...tarde]);

    expect(day.efectivo.neto).toBe(7000);
    expect(day.transferencia.neto).toBe(2000);
    // El total del día es la suma de lo que muestra cada turno por separado.
    expect(day.ingresos).toBe(summarizeDay(manana).ingresos + summarizeDay(tarde).ingresos);
    expect(day.egresos).toBe(summarizeDay(manana).egresos + summarizeDay(tarde).egresos);
    expect(collectedBySales([...manana, ...tarde])).toEqual({ efectivo: 8000, transferencia: 2000 });
  });
});
