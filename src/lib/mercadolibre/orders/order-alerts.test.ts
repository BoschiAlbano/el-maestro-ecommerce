import { describe, expect, it } from "vitest";
import { buildOrderAlerts, deadlineState } from "./order-alerts";

const now = new Date("2026-11-24T20:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe("deadlineState (RF-17)", () => {
  it("vence en menos de 4 horas", () => {
    expect(deadlineState({ status: "TO_PREPARE", dispatchDeadline: at(3) }, now)).toBe("soon");
    expect(deadlineState({ status: "READY_TO_SHIP", dispatchDeadline: at(4) }, now)).toBe("soon");
  });

  it("todavía falta", () => {
    expect(deadlineState({ status: "TO_PREPARE", dispatchDeadline: at(5) }, now)).toBeNull();
  });

  it("vencida", () => {
    expect(deadlineState({ status: "TO_PREPARE", dispatchDeadline: at(-1) }, now)).toBe("overdue");
  });

  it("ya despachada, cancelada o sin fecha: nada", () => {
    expect(deadlineState({ status: "SHIPPED", dispatchDeadline: at(-1) }, now)).toBeNull();
    expect(deadlineState({ status: "CANCELLED", dispatchDeadline: at(1) }, now)).toBeNull();
    expect(deadlineState({ status: "TO_PREPARE", dispatchDeadline: null }, now)).toBeNull();
  });
});

describe("buildOrderAlerts", () => {
  it("sin nada, sin avisos", () => {
    expect(buildOrderAlerts({ soon: 0, overdue: 0, fraud: 0 })).toEqual([]);
  });

  it("un aviso por tipo, con singular y plural", () => {
    const alerts = buildOrderAlerts({ soon: 2, overdue: 1, fraud: 1 });
    expect(alerts.map((a) => a.message)).toEqual([
      "Hay 1 orden de Mercado Libre con el despacho vencido.",
      "Hay 2 órdenes de Mercado Libre que vencen en menos de 4 horas.",
      "Hay 1 orden con riesgo de fraude: no la despaches.",
    ]);
    expect(alerts.every((a) => a.href === "/ordenes")).toBe(true);
  });
});
