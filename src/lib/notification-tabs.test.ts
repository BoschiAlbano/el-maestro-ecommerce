import { describe, expect, it } from "vitest";
import { NotificationType } from "@/generated/prisma/enums";
import { NOTIFICATION_ICON, NOTIFICATION_TAB, inTab, isUrgentType, relativeTime, tabCounts } from "./notification-tabs";

describe("pestaña de cada aviso (specs/013, RF-9)", () => {
  it("los del local van a Sistema y los de Mercado Libre a su pestaña", () => {
    expect(NOTIFICATION_TAB.PEDIDO_NUEVO).toBe("sistema");
    expect(NOTIFICATION_TAB.DIFERENCIA_CAJA).toBe("sistema");
    expect(NOTIFICATION_TAB.TOPE_FACTURACION).toBe("sistema");
    for (const type of Object.values(NotificationType).filter((t) => t.startsWith("ML_"))) {
      expect(NOTIFICATION_TAB[type]).toBe("mercadolibre");
    }
  });

  it("todo tipo tiene pestaña e ícono", () => {
    for (const type of Object.values(NotificationType)) {
      expect(NOTIFICATION_TAB[type]).toBeDefined();
      expect(NOTIFICATION_ICON[type]).toBeDefined();
    }
  });

  it("urgentes: fraude, venta sin stock y reconexión (RF-12)", () => {
    const urgent = Object.values(NotificationType).filter(isUrgentType).sort();
    expect(urgent).toEqual(["ML_FRAUDE", "ML_RECONEXION", "ML_VENTA_SIN_STOCK"]);
  });

  it("«Todos» incluye las dos pestañas", () => {
    expect(inTab("todos", "sistema")).toBe(true);
    expect(inTab("todos", "mercadolibre")).toBe(true);
    expect(inTab("sistema", "mercadolibre")).toBe(false);
  });
});

describe("tabCounts (RF-8)", () => {
  it("cuenta por pestaña; el stock bajo suma uno en Sistema", () => {
    expect(
      tabCounts({
        items: [{ tab: "sistema" }, { tab: "mercadolibre" }, { tab: "mercadolibre" }],
        liveAlerts: [{ tab: "mercadolibre" }],
        stockBajo: true,
      }),
    ).toEqual({ todos: 5, sistema: 2, mercadolibre: 3 });
  });

  it("sin avisos, todo en cero", () => {
    expect(tabCounts({ items: [], liveAlerts: [], stockBajo: false })).toEqual({ todos: 0, sistema: 0, mercadolibre: 0 });
  });
});

describe("relativeTime (RF-12, hora de Tucumán)", () => {
  // 20/11/2026 21:00 en Tucumán (UTC-3).
  const now = new Date("2026-11-21T00:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("menos de un minuto", () => {
    expect(relativeTime(ago(0), now)).toBe("hace un momento");
    expect(relativeTime(new Date(now.getTime() - 59_000), now)).toBe("hace un momento");
  });

  it("minutos", () => {
    expect(relativeTime(ago(1), now)).toBe("hace 1 min");
    expect(relativeTime(ago(59), now)).toBe("hace 59 min");
  });

  it("horas, mientras sea el mismo día", () => {
    expect(relativeTime(ago(60), now)).toBe("hace 1 h");
    expect(relativeTime(ago(20 * 60 + 59), now)).toBe("hace 20 h");
  });

  it("del día anterior: «ayer» con la hora, aunque hayan pasado menos de 24 horas", () => {
    // 19/11 23:30 en Tucumán: hace 21 h 30 min, pero ya es otro día.
    expect(relativeTime(ago(21 * 60 + 30), now)).toBe("ayer 23:30");
    expect(relativeTime(new Date("2026-11-19T21:40:00Z"), now)).toBe("ayer 18:40");
  });

  it("más viejo: día, mes y hora", () => {
    expect(relativeTime(new Date("2026-11-12T21:40:00Z"), now)).toBe("12/11 18:40");
  });
});
