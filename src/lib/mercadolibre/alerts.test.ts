import { describe, expect, it } from "vitest";
import { buildPendingSyncAlert, pendingAlertCutoff, PENDING_ALERT_MINUTES } from "./alerts";

describe("buildPendingSyncAlert (specs/021, RF-7)", () => {
  it("sin pendientes no hay aviso", () => {
    expect(buildPendingSyncAlert(0)).toBeNull();
  });

  it("singular y plural, con enlace a publicaciones", () => {
    expect(buildPendingSyncAlert(1)).toEqual({
      key: "mercadolibre-pendientes",
      message: "Hay 1 publicación con cambios sin enviar a Mercado Libre.",
      href: "/publicaciones",
      tab: "mercadolibre",
      icon: "publicacion",
      urgent: false,
    });
    expect(buildPendingSyncAlert(3)?.message).toBe("Hay 3 publicaciones con cambios sin enviar a Mercado Libre.");
  });
});

describe("pendingAlertCutoff", () => {
  it("cuenta solo lo pendiente desde hace más de unos minutos", () => {
    const now = new Date("2026-11-19T12:00:00Z");
    expect(pendingAlertCutoff(now).toISOString()).toBe(
      new Date(now.getTime() - PENDING_ALERT_MINUTES * 60_000).toISOString(),
    );
    expect(PENDING_ALERT_MINUTES).toBe(2);
  });
});
