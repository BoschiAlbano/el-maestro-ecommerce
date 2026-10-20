import { describe, expect, it } from "vitest";
import { RESET_PHRASE, summarizeReset, validateResetConfirmation, type ResetCounts } from "./system-reset";

const empty: ResetCounts = {
  products: 0,
  brands: 0,
  rubros: 0,
  sales: 0,
  orders: 0,
  stockEntries: 0,
  cashShifts: 0,
  employees: 0,
  otherUsers: 0,
  otherRoles: 0,
  auditLogs: 0,
  openShift: false,
  pendingOrders: 0,
};

describe("validateResetConfirmation", () => {
  it("acepta la contraseña y la frase exacta", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: RESET_PHRASE })).toBeNull();
  });

  it("ignora los espacios de los extremos de la frase", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: `  ${RESET_PHRASE} ` })).toBeNull();
  });

  it("exige la frase tal cual: mayúsculas y espacios internos", () => {
    expect(validateResetConfirmation({ password: "clave", phrase: "reiniciar el sistema" })).not.toBeNull();
    expect(validateResetConfirmation({ password: "clave", phrase: "REINICIAR  EL SISTEMA" })).not.toBeNull();
    expect(validateResetConfirmation({ password: "clave", phrase: "" })).not.toBeNull();
  });

  it("exige la contraseña", () => {
    expect(validateResetConfirmation({ password: "", phrase: RESET_PHRASE })).toBe("Ingresá tu contraseña.");
  });
});

describe("summarizeReset", () => {
  it("lista todo en cero para un sistema vacío, sin avisos", () => {
    const { rows, warnings } = summarizeReset(empty);
    expect(rows.every((r) => r.count === 0)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("usa singular y plural según la cantidad", () => {
    const { rows } = summarizeReset({ ...empty, products: 1, sales: 3 });
    expect(rows.find((r) => r.count === 1)?.label).toBe("producto");
    expect(rows.find((r) => r.count === 3)?.label).toBe("ventas");
  });

  it("avisa de un turno abierto y de los pedidos pendientes", () => {
    const { warnings } = summarizeReset({ ...empty, openShift: true, pendingOrders: 2 });
    expect(warnings).toEqual([
      "Hay un turno de caja abierto: se va a perder.",
      "Hay 2 pedidos pendientes: se van a perder.",
    ]);
  });

  it("avisa en singular con un solo pedido pendiente", () => {
    expect(summarizeReset({ ...empty, pendingOrders: 1 }).warnings).toEqual(["Hay 1 pedido pendiente: se va a perder."]);
  });
});
