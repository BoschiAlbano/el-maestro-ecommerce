import { describe, expect, it } from "vitest";
import { collectedBySales, summarizeDay } from "./cash-day";
import { computeExpectedCash, summarizeShift, type CashMovementForExpected } from "./cash-shift";

// Pruebas de coherencia de los números de caja (specs/007 y 014): con muchos
// conjuntos de movimientos al azar, las distintas cuentas tienen que contar la
// misma historia. Complementan los casos puntuales de cash-shift.test.ts y
// cash-day.test.ts. El generador es determinista, así que una falla se reproduce.

function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

type Mv = CashMovementForExpected & { saleId: string | null };

function randomMovements(next: () => number, max = 30): Mv[] {
  const count = Math.floor(next() * max);
  return Array.from({ length: count }, (_, i) => ({
    type: next() < 0.6 ? "INGRESO" : "EGRESO",
    amount: Math.round(next() * 100000) / 100,
    paymentMethod: next() < 0.5 ? "EFECTIVO" : "TRANSFERENCIA",
    saleId: next() < 0.4 ? `sale-${i % 5}` : null,
  }));
}

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("coherencia de los números de caja", () => {
  it("las identidades entre ingresos, egresos, efectivo y transferencia se cumplen siempre", () => {
    const next = rng(1);
    for (let run = 0; run < 200; run++) {
      const movements = randomMovements(next);
      const opening = Math.round(next() * 50000);
      const s = summarizeShift(opening, movements);

      close(s.ingresos, s.efectivo.ingresos + s.transferencia.ingresos);
      close(s.egresos, s.efectivo.egresos + s.transferencia.egresos);
      close(s.efectivo.neto, s.efectivo.ingresos - s.efectivo.egresos);
      close(s.transferencia.neto, s.transferencia.ingresos - s.transferencia.egresos);
      // Total del turno (tarjeta 3) = neto en efectivo + neto por transferencia = entradas − salidas.
      close(s.efectivo.neto + s.transferencia.neto, s.ingresos - s.egresos);
      // El efectivo esperado es el inicial más el neto en efectivo; la transferencia no lo toca.
      close(s.expectedCash, opening + s.efectivo.neto);
      close(s.expectedCash, computeExpectedCash(opening, movements));
    }
  });

  it("la caja de un día es la suma de sus turnos, sin contar los montos iniciales", () => {
    const next = rng(2);
    for (let run = 0; run < 100; run++) {
      const shifts = Array.from({ length: 1 + Math.floor(next() * 4) }, () => ({
        opening: Math.round(next() * 50000),
        movements: randomMovements(next, 15),
      }));
      const day = summarizeDay(shifts.flatMap((shift) => shift.movements));
      const perShift = shifts.map((shift) => summarizeShift(shift.opening, shift.movements));

      close(day.ingresos, perShift.reduce((sum, s) => sum + s.ingresos, 0));
      close(day.egresos, perShift.reduce((sum, s) => sum + s.egresos, 0));
      close(day.efectivo.neto, perShift.reduce((sum, s) => sum + s.efectivo.neto, 0));
      close(day.transferencia.neto, perShift.reduce((sum, s) => sum + s.transferencia.neto, 0));
      // El efectivo esperado de cada turno incluye su inicial; el del día, no.
      close(
        day.efectivo.neto,
        perShift.reduce((sum, s) => sum + s.expectedCash, 0) - shifts.reduce((sum, shift) => sum + shift.opening, 0),
      );
    }
  });

  it("lo cobrado por ventas nunca supera las entradas, y las señas y movimientos manuales no entran", () => {
    const next = rng(3);
    for (let run = 0; run < 200; run++) {
      const movements = randomMovements(next);
      const collected = collectedBySales(movements);
      const s = summarizeShift(0, movements);

      // Lo cobrado por ventas es una parte del neto de cada medio, nunca más.
      const manualEfectivo = movements
        .filter((m) => !m.saleId && m.paymentMethod === "EFECTIVO")
        .reduce((sum, m) => sum + (m.type === "INGRESO" ? m.amount : -m.amount), 0);
      close(collected.efectivo + manualEfectivo, s.efectivo.neto);
      const manualTransfer = movements
        .filter((m) => !m.saleId && m.paymentMethod === "TRANSFERENCIA")
        .reduce((sum, m) => sum + (m.type === "INGRESO" ? m.amount : -m.amount), 0);
      close(collected.transferencia + manualTransfer, s.transferencia.neto);
    }
  });

  it("una venta anulada en el mismo turno cobra y devuelve lo mismo: neta cero", () => {
    const movements: Mv[] = [
      { type: "INGRESO", amount: 5000, paymentMethod: "EFECTIVO", saleId: "v1" },
      { type: "INGRESO", amount: 100000, paymentMethod: "TRANSFERENCIA", saleId: "v1" },
      { type: "EGRESO", amount: 5000, paymentMethod: "EFECTIVO", saleId: "v1" },
      { type: "EGRESO", amount: 100000, paymentMethod: "TRANSFERENCIA", saleId: "v1" },
    ];
    expect(collectedBySales(movements)).toEqual({ efectivo: 0, transferencia: 0 });
    const s = summarizeShift(10000, movements);
    expect(s.expectedCash).toBe(10000);
    expect(s.ingresos - s.egresos).toBe(0);
  });
});
