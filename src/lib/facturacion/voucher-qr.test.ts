import { describe, expect, it } from "vitest";
import { QR_BASE_URL, buildQrUrl, encodeQrPayload, type QrPayload } from "./qr";
import { VoucherInputError, arcaDate, arcaDateOnly, buildVoucherRequest, type VoucherInput } from "./voucher";

const EMITTER = "20-11111111-2";

describe("arcaDate", () => {
  it("AAAAMMDD en horario de Tucumán", () => {
    expect(arcaDate(new Date("2026-11-11T15:00:00Z"))).toBe("20261111");
  });

  it("a las 22:00 de Tucumán sigue siendo ese día, aunque en UTC ya sea el siguiente", () => {
    expect(arcaDate(new Date("2026-11-12T01:00:00Z"))).toBe("20261111");
    expect(arcaDate(new Date("2026-11-12T03:00:00Z"))).toBe("20261112");
  });
});

describe("arcaDateOnly (fecha sin hora, como sale de la base)", () => {
  it("no se corre un día aunque la medianoche UTC sea la noche anterior en Tucumán", () => {
    expect(arcaDateOnly(new Date("2026-11-11T00:00:00.000Z"))).toBe("20261111");
    // Con la conversión de momentos daría el día anterior: eso es lo que no tiene que pasar.
    expect(arcaDate(new Date("2026-11-11T00:00:00.000Z"))).toBe("20261110");
  });
});

describe("buildVoucherRequest", () => {
  const base: VoucherInput = {
    kind: "FACTURA_C",
    emitterCuit: EMITTER,
    pointOfSale: 1,
    number: 69,
    total: 12500,
    issueDate: new Date("2026-11-11T15:00:00Z"),
    receiver: { docType: "NONE", ivaCondition: 5 },
  };

  it("factura C a Consumidor Final: documento 99/0, sin IVA, total como neto", () => {
    expect(buildVoucherRequest(base)).toEqual({
      CantReg: 1,
      PtoVta: 1,
      CbteTipo: 11,
      Concepto: 1,
      DocTipo: 99,
      DocNro: 0,
      CbteDesde: 69,
      CbteHasta: 69,
      CbteFch: "20261111",
      ImpTotal: 12500,
      ImpTotConc: 0,
      ImpNeto: 12500,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: 5,
    });
  });

  it("con DNI y con CUIT, el número va solo con dígitos", () => {
    const dni = buildVoucherRequest({ ...base, receiver: { docType: "DNI", docNumber: "12.345.678", ivaCondition: 5 } });
    expect([dni.DocTipo, dni.DocNro]).toEqual([96, 12345678]);

    const cuit = buildVoucherRequest({
      ...base,
      receiver: { docType: "CUIT", docNumber: "20-11111111-2", ivaCondition: 6 },
    });
    expect([cuit.DocTipo, cuit.DocNro, cuit.CondicionIVAReceptorId]).toEqual([80, 20111111112, 6]);
  });

  it("nota de crédito: tipo 13 y asociada a la factura original", () => {
    const request = buildVoucherRequest({
      ...base,
      kind: "NOTA_CREDITO_C",
      number: 12,
      // La fecha de la factura original sale de la base: medianoche UTC.
      associatedInvoice: { pointOfSale: 1, number: 69, issueDate: new Date("2026-11-01T00:00:00.000Z") },
    });
    expect(request.CbteTipo).toBe(13);
    expect(request.CbteDesde).toBe(12);
    expect(request.CbtesAsoc).toEqual([
      { Tipo: 11, PtoVta: 1, Nro: 69, Cuit: "20111111112", CbteFch: "20261101" },
    ]);
  });

  it("la factura no lleva comprobantes asociados", () => {
    expect(buildVoucherRequest(base).CbtesAsoc).toBeUndefined();
  });

  it("redondea a dos decimales sin errores de coma flotante", () => {
    expect(buildVoucherRequest({ ...base, total: 0.1 + 0.2 }).ImpTotal).toBe(0.3);
    expect(buildVoucherRequest({ ...base, total: 1234.5 }).ImpNeto).toBe(1234.5);
  });

  it("rechaza lo que ARCA rechazaría, antes de llamarla", () => {
    const fails = (patch: Partial<VoucherInput>) => () => buildVoucherRequest({ ...base, ...patch });
    expect(fails({ total: 0 })).toThrow(VoucherInputError);
    expect(fails({ total: -5 })).toThrow(VoucherInputError);
    expect(fails({ total: Number.NaN })).toThrow(VoucherInputError);
    expect(fails({ number: 0 })).toThrow(VoucherInputError);
    expect(fails({ number: 1.5 })).toThrow(VoucherInputError);
    expect(fails({ kind: "NOTA_CREDITO_C" })).toThrow(/factura que anula/);
    expect(
      fails({ associatedInvoice: { pointOfSale: 1, number: 1, issueDate: new Date() } }),
    ).toThrow(/no se asocia/);
    expect(fails({ receiver: { docType: "NONE", docNumber: "123", ivaCondition: 5 } })).toThrow(/no lleva/);
    expect(fails({ receiver: { docType: "DNI", docNumber: "", ivaCondition: 5 } })).toThrow(/Falta/);
  });
});

describe("QR (especificación oficial de ARCA)", () => {
  // Ejemplo de https://www.arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf:
  // el texto codificado en el QR, tal cual figura en la página.
  const OFFICIAL_BASE64 =
    "eyJ2ZXIiOjEsImZlY2hhIjoiMjAyMC0xMC0xMyIsImN1" +
    "aXQiOjMwMDAwMDAwMDA3LCJwdG9WdGEiOjEwLCJ0aXBvQ21wIjoxLCJucm9DbXAiO" +
    "jk0LCJpbXBvcnRlIjoxMjEwMCwibW9uZWRhIjoiRE9MIiwiY3R6Ijo2NSwidGlwb0RvY1JlYyI" +
    "6ODAsIm5yb0RvY1JlYyI6MjAwMDAwMDAwMDEsInRpcG9Db2RBdXQiOiJFIiwiY29kQXV" +
    "0Ijo3MDQxNzA1NDM2NzQ3Nn0=";

  const OFFICIAL_PAYLOAD: QrPayload = {
    ver: 1,
    fecha: "2020-10-13",
    cuit: 30000000007,
    ptoVta: 10,
    tipoCmp: 1,
    nroCmp: 94,
    importe: 12100,
    moneda: "DOL",
    ctz: 65,
    tipoDocRec: 80,
    nroDocRec: 20000000001,
    tipoCodAut: "E",
    codAut: 70417054367476,
  };

  it("el ejemplo oficial da exactamente el mismo texto", () => {
    expect(encodeQrPayload(OFFICIAL_PAYLOAD)).toBe(`${QR_BASE_URL}?p=${OFFICIAL_BASE64}`);
  });

  it("el texto del ejemplo oficial se decodifica al JSON de la especificación", () => {
    const json = Buffer.from(OFFICIAL_BASE64, "base64").toString("utf8");
    expect(JSON.parse(json)).toEqual(OFFICIAL_PAYLOAD);
  });

  it("la dirección base es la de la especificación vigente", () => {
    expect(QR_BASE_URL).toBe("https://www.arca.gob.ar/fe/qr/");
  });

  const invoice = {
    kind: "FACTURA_C" as const,
    emitterCuit: EMITTER,
    pointOfSale: 1,
    number: 69,
    total: 12500,
    issueDate: new Date("2026-11-11T15:00:00Z"),
    cae: "70417054367476",
    receiverDocType: "DNI" as const,
    receiverDocNumber: "12345678",
  };
  const decode = (url: string) => JSON.parse(Buffer.from(new URL(url).searchParams.get("p")!, "base64").toString("utf8"));

  it("el QR de una factura C lleva sus datos, en pesos", () => {
    expect(decode(buildQrUrl(invoice))).toEqual({
      ver: 1,
      fecha: "2026-11-11",
      cuit: 20111111112,
      ptoVta: 1,
      tipoCmp: 11,
      nroCmp: 69,
      importe: 12500,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 96,
      nroDocRec: 12345678,
      tipoCodAut: "E",
      codAut: 70417054367476,
    });
  });

  it("Consumidor Final: documento 99 y número 0", () => {
    const payload = decode(buildQrUrl({ ...invoice, receiverDocType: "NONE", receiverDocNumber: null }));
    expect([payload.tipoDocRec, payload.nroDocRec]).toEqual([99, 0]);
  });

  it("una nota de crédito lleva el tipo 13", () => {
    expect(decode(buildQrUrl({ ...invoice, kind: "NOTA_CREDITO_C" })).tipoCmp).toBe(13);
  });

  it("la fecha del QR es la del comprobante, sin correrse por la zona horaria", () => {
    // Así sale de la base: medianoche UTC. Tiene que dar ese mismo día, no el anterior.
    expect(decode(buildQrUrl({ ...invoice, issueDate: new Date("2026-11-11T00:00:00.000Z") })).fecha).toBe("2026-11-11");
    expect(decode(buildQrUrl({ ...invoice, issueDate: new Date("2026-01-01T00:00:00.000Z") })).fecha).toBe("2026-01-01");
  });

  it("el código de autorización de 14 dígitos entra sin perder precisión", () => {
    expect(Number.isSafeInteger(Number("99999999999999"))).toBe(true);
    expect(decode(buildQrUrl({ ...invoice, cae: "99999999999999" })).codAut).toBe(99999999999999);
  });
});
