import { describe, expect, it } from "vitest";
import { buildInvoicingAlerts } from "./alerts";

describe("buildInvoicingAlerts", () => {
  it("sin problemas no hay avisos", () => {
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: null })).toEqual([]);
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: 200 })).toEqual([]);
  });

  it("avisa de los comprobantes pendientes, en singular y plural", () => {
    expect(buildInvoicingAlerts({ pendingCount: 1, certificateDaysLeft: null })[0].message).toMatch(/1 comprobante pendiente/);
    expect(buildInvoicingAlerts({ pendingCount: 3, certificateDaysLeft: null })[0].message).toMatch(/3 comprobantes pendientes/);
  });

  it("avisa del certificado desde los 30 días, y distingue vence hoy y ya venció", () => {
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: 31 })).toEqual([]);
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: 30 })[0].message).toMatch(/vence en 30 días/);
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: 1 })[0].message).toMatch(/vence en 1 día\./);
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: 0 })[0].message).toMatch(/vence hoy/);
    expect(buildInvoicingAlerts({ pendingCount: 0, certificateDaysLeft: -2 })[0].message).toMatch(/venció/);
  });

  it("puede haber los dos avisos a la vez, cada uno con su destino", () => {
    const alerts = buildInvoicingAlerts({ pendingCount: 2, certificateDaysLeft: 5 });
    expect(alerts.map((a) => a.href)).toEqual(["/comprobantes?estado=PENDING", "/configuracion?tab=facturacion"]);
  });

  it("van a la pestaña Sistema, con el ícono de factura (specs/013, sección 11)", () => {
    const alerts = buildInvoicingAlerts({ pendingCount: 2, certificateDaysLeft: 5 });
    expect(alerts.every((a) => a.tab === "sistema" && a.icon === "factura" && !a.urgent)).toBe(true);
  });
});
