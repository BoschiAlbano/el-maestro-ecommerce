import { describe, expect, it } from "vitest";
import { roundToPeso } from "./money";

describe("roundToPeso", () => {
  it("redondea para abajo por debajo de 0,5", () => {
    expect(roundToPeso(100.49)).toBe(100);
    expect(roundToPeso(100.1)).toBe(100);
  });

  it("redondea para arriba en 0,5 exacto", () => {
    expect(roundToPeso(100.5)).toBe(101);
    expect(roundToPeso(0.5)).toBe(1);
  });

  it("redondea para arriba por encima de 0,5", () => {
    expect(roundToPeso(100.51)).toBe(101);
  });

  it("no toca un monto que ya es entero", () => {
    expect(roundToPeso(100)).toBe(100);
  });

  it("acepta strings y Decimal (lo que puede venir de Prisma)", () => {
    expect(roundToPeso("1234.5")).toBe(1235);
  });
});
