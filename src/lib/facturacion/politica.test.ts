import { describe, expect, it } from "vitest";
import { accumulatedLast12Months, capUsagePercent, crossedWarning, netInvoiced, type AccumulatedInvoice } from "./accumulated";
import { fiscalDate, fiscalDaysBetween, oneYearBefore } from "./fechas";
import { canInvoice, missingForInvoicing, type FiscalConfigData } from "./fiscal-config";
import { decideOnVoid, invoiceBlocker, requiresIdentification, validateReceiver } from "./invoice-policy";

// Tucumán está 3 horas detrás de UTC, sin horario de verano.
const at = (iso: string) => new Date(iso);

describe("fechas fiscales (horario de Tucumán)", () => {
  it("una venta a las 22:00 de Tucumán es de ese día, aunque en UTC ya sea el siguiente", () => {
    expect(fiscalDate(at("2026-11-12T01:00:00Z"))).toBe("2026-11-11");
    expect(fiscalDate(at("2026-11-12T03:00:00Z"))).toBe("2026-11-12");
  });

  it("cuenta días de calendario, no bloques de 24 horas", () => {
    // 23:30 del 10 a 00:30 del 11 (Tucumán): una hora, pero un día de calendario.
    expect(fiscalDaysBetween(at("2026-11-11T02:30:00Z"), at("2026-11-11T03:30:00Z"))).toBe(1);
    // Mismo día.
    expect(fiscalDaysBetween(at("2026-11-11T12:00:00Z"), at("2026-11-11T22:00:00Z"))).toBe(0);
    expect(fiscalDaysBetween(at("2026-11-06T15:00:00Z"), at("2026-11-11T15:00:00Z"))).toBe(5);
  });

  it("un año antes, con el 29 de febrero", () => {
    expect(oneYearBefore(at("2026-11-11T15:00:00Z"))).toBe("2025-11-11");
    expect(oneYearBefore(at("2028-02-29T15:00:00Z"))).toBe("2027-02-28");
  });
});

describe("missingForInvoicing", () => {
  const NOW = at("2026-11-11T15:00:00Z");
  const config: FiscalConfigData = {
    razonSocial: "Negocio de Prueba",
    cuit: "20-11111111-2",
    domicilioComercial: "Calle Falsa 123",
    iibb: "20111111112",
    inicioActividades: at("2026-11-01T00:00:00Z"),
    puntoDeVenta: 3,
  };
  const certificate = { loaded: true, cuit: "20111111112", expiresAt: at("2028-01-01T00:00:00Z") };
  const complete = { config, certificate, hasEncryptionKey: true, now: NOW };

  it("con todo cargado no falta nada", () => {
    expect(missingForInvoicing(complete)).toEqual([]);
    expect(canInvoice(complete)).toBe(true);
  });

  it("sin configurar nada lista todo lo que falta", () => {
    const missing = missingForInvoicing({ config: null, certificate: null, hasEncryptionKey: false, now: NOW });
    expect(missing).toHaveLength(8);
    expect(canInvoice({ config: null, certificate: null, hasEncryptionKey: false, now: NOW })).toBe(false);
  });

  it("señala cada dato que falta", () => {
    const without = (patch: Partial<FiscalConfigData>) => missingForInvoicing({ ...complete, config: { ...config, ...patch } });
    expect(without({ razonSocial: "  " })).toEqual(["Cargar la razón social."]);
    expect(without({ cuit: "20111111113" })).toEqual(["El CUIT cargado no es válido."]);
    expect(without({ domicilioComercial: "" })).toEqual(["Cargar el domicilio comercial."]);
    expect(without({ iibb: "" })).toEqual(["Cargar el número de Ingresos Brutos."]);
    expect(without({ inicioActividades: null })).toEqual(["Cargar la fecha de inicio de actividades."]);
    expect(without({ puntoDeVenta: null })).toEqual(["Cargar el punto de venta."]);
    expect(without({ puntoDeVenta: 0 })).toEqual(["Cargar el punto de venta."]);
  });

  it("certificado: sin cargar, vencido o de otro CUIT", () => {
    expect(missingForInvoicing({ ...complete, certificate: null })).toEqual(["Cargar el certificado de ARCA."]);
    expect(missingForInvoicing({ ...complete, certificate: { ...certificate, loaded: false } })).toEqual([
      "Cargar el certificado de ARCA.",
    ]);
    expect(
      missingForInvoicing({ ...complete, certificate: { ...certificate, expiresAt: at("2026-11-10T00:00:00Z") } })[0],
    ).toMatch(/vencido/);
    expect(missingForInvoicing({ ...complete, certificate: { ...certificate, cuit: "30500010912" } })[0]).toMatch(
      /otro CUIT/,
    );
  });

  it("sin la clave de cifrado del servidor no se puede facturar", () => {
    expect(missingForInvoicing({ ...complete, hasEncryptionKey: false })[0]).toMatch(/clave de cifrado/);
  });
});

describe("identificación del comprador", () => {
  const TOPE = 10_000_000;

  it("obliga justo desde el monto", () => {
    expect(requiresIdentification(9_999_999, TOPE)).toBe(false);
    expect(requiresIdentification(10_000_000, TOPE)).toBe(true);
    expect(requiresIdentification(10_000_001, TOPE)).toBe(true);
  });

  it("Consumidor Final sin datos: válido por debajo del monto, no desde el monto", () => {
    expect(validateReceiver({ docType: "NONE" }, 50_000, TOPE)).toBeNull();
    expect(validateReceiver({ docType: "NONE" }, 10_000_000, TOPE)).toMatch(/nombre y el documento/);
  });

  it("con documento hace falta que sea válido y el nombre", () => {
    expect(validateReceiver({ docType: "DNI", docNumber: "12345678", name: "Juan Pérez" }, 50_000, TOPE)).toBeNull();
    expect(validateReceiver({ docType: "DNI", docNumber: "123", name: "Juan" }, 50_000, TOPE)).toMatch(/7 u 8/);
    expect(validateReceiver({ docType: "CUIT", docNumber: "20111111112", name: " " }, 50_000, TOPE)).toMatch(/nombre/);
    expect(validateReceiver({ docType: "CUIT", docNumber: "20111111113", name: "SA" }, 50_000, TOPE)).toMatch(
      /no es válido/,
    );
  });

  it("identificado y por encima del monto: válido", () => {
    expect(validateReceiver({ docType: "CUIT", docNumber: "20111111112", name: "Cliente SA" }, 12_000_000, TOPE)).toBeNull();
  });
});

describe("invoiceBlocker", () => {
  const NOW = at("2026-11-11T15:00:00Z");
  const sale = { createdAt: at("2026-11-11T13:00:00Z"), voidedAt: null, hasActiveInvoice: false };

  it("una venta de hoy, sin factura ni anulación, se puede facturar", () => {
    expect(invoiceBlocker(sale, NOW, 5)).toBeNull();
  });

  it("no se factura una venta anulada ni una ya facturada", () => {
    expect(invoiceBlocker({ ...sale, voidedAt: NOW }, NOW, 5)).toMatch(/anulada/);
    expect(invoiceBlocker({ ...sale, hasActiveInvoice: true }, NOW, 5)).toMatch(/ya tiene/);
  });

  it("respeta el plazo, justo en el borde", () => {
    expect(invoiceBlocker({ ...sale, createdAt: at("2026-11-06T15:00:00Z") }, NOW, 5)).toBeNull();
    expect(invoiceBlocker({ ...sale, createdAt: at("2026-11-05T15:00:00Z") }, NOW, 5)).toMatch(/hasta 5 días/);
  });

  it("con plazo 0 solo vale el mismo día de Tucumán", () => {
    expect(invoiceBlocker(sale, NOW, 0)).toBeNull();
    // Ayer a las 23:30 de Tucumán.
    expect(invoiceBlocker({ ...sale, createdAt: at("2026-11-11T02:30:00Z") }, NOW, 0)).toMatch(/mismo día/);
  });
});

describe("decideOnVoid", () => {
  it("factura autorizada: nota de crédito", () => {
    expect(decideOnVoid({ status: "AUTHORIZED" })).toBe("credit_note");
  });

  it("factura pendiente: primero comprobar en ARCA", () => {
    expect(decideOnVoid({ status: "PENDING" })).toBe("verify_then_decide");
  });

  it("sin factura o descartada: nada", () => {
    expect(decideOnVoid(null)).toBe("nothing");
    expect(decideOnVoid({ status: "DISCARDED" })).toBe("nothing");
  });
});

describe("acumulado contra el tope", () => {
  const NOW = at("2026-11-11T15:00:00Z");
  const invoice = (patch: Partial<AccumulatedInvoice>): AccumulatedInvoice => ({
    kind: "FACTURA_C",
    status: "AUTHORIZED",
    environment: "PRODUCCION",
    total: 100_000,
    issueDate: at("2026-10-01T15:00:00Z"),
    ...patch,
  });

  it("facturas menos notas de crédito", () => {
    expect(netInvoiced([invoice({}), invoice({ total: 250_000 }), invoice({ kind: "NOTA_CREDITO_C", total: 100_000 })])).toBe(
      250_000,
    );
  });

  it("no cuentan los comprobantes de prueba, los pendientes ni los descartados", () => {
    expect(
      netInvoiced([
        invoice({}),
        invoice({ environment: "HOMOLOGACION" }),
        invoice({ status: "PENDING", issueDate: null }),
        invoice({ status: "DISCARDED" }),
      ]),
    ).toBe(100_000);
  });

  it("solo los últimos 12 meses, sin incluir el mismo día del año anterior", () => {
    const list = [
      invoice({ issueDate: at("2026-11-11T14:00:00Z") }), // hoy: cuenta
      invoice({ issueDate: at("2025-11-12T15:00:00Z") }), // un día después del borde: cuenta
      invoice({ issueDate: at("2025-11-11T15:00:00Z") }), // el borde: no cuenta
      invoice({ issueDate: at("2024-06-01T15:00:00Z") }), // viejo: no cuenta
    ];
    expect(accumulatedLast12Months(list, NOW)).toBe(200_000);
  });

  it("la fecha del comprobante se lee sin hora: la medianoche UTC no se corre un día", () => {
    // Así sale de la base. Un día después del borde tiene que contar; con la conversión
    // de momentos a Tucumán daría el día del borde y no contaría.
    const list = [
      invoice({ issueDate: at("2025-11-12T00:00:00.000Z") }),
      invoice({ issueDate: at("2025-11-11T00:00:00.000Z") }),
    ];
    expect(accumulatedLast12Months(list, NOW)).toBe(100_000);
  });

  it("avisa solo al cruzar el 80 %", () => {
    const TOPE = 1_000_000;
    expect(crossedWarning(700_000, 799_999, TOPE)).toBe(false);
    expect(crossedWarning(700_000, 800_000, TOPE)).toBe(true);
    expect(crossedWarning(799_999, 1_500_000, TOPE)).toBe(true);
    // Ya estaba por encima: no vuelve a avisar, ni al llegar al tope ni al pasarlo.
    expect(crossedWarning(800_000, 900_000, TOPE)).toBe(false);
    expect(crossedWarning(950_000, 1_200_000, TOPE)).toBe(false);
  });

  it("sin tope cargado no avisa ni calcula porcentaje", () => {
    expect(crossedWarning(0, 999_999_999, null)).toBe(false);
    expect(crossedWarning(0, 999_999_999, 0)).toBe(false);
    expect(capUsagePercent(500_000, null)).toBeNull();
  });

  it("porcentaje del tope, que puede pasar de 100", () => {
    expect(capUsagePercent(500_000, 1_000_000)).toBe(50);
    expect(capUsagePercent(1_200_000, 1_000_000)).toBe(120);
  });
});
