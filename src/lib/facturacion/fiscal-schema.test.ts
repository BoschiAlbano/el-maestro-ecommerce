import { describe, expect, it } from "vitest";
import { changedFields, fiscalConfigSchema, parseAmount } from "./fiscal-schema";

const valid = {
  razonSocial: "  Negocio de Prueba  ",
  cuit: "20-11111111-2",
  domicilioComercial: "Calle Falsa 123, San Miguel de Tucumán",
  iibb: "901-123456-7",
  inicioActividades: "2026-11-01",
  puntoDeVenta: "3",
  topeAnual: "17.595.182,74",
  montoIdentificacion: "10000000",
  diasParaFacturar: "5",
};

const parse = (patch: Record<string, string | undefined> = {}) => fiscalConfigSchema.safeParse({ ...valid, ...patch });
const firstError = (patch: Record<string, string | undefined>) => {
  const result = parse(patch);
  return result.success ? null : result.error.issues[0].message;
};

describe("fiscalConfigSchema", () => {
  it("acepta un formulario completo y lo normaliza", () => {
    const result = parse({ topeAnual: "17595182,74" });
    expect(result.success).toBe(true);
    expect(result.success && result.data).toMatchObject({
      razonSocial: "Negocio de Prueba",
      cuit: "20111111112",
      puntoDeVenta: 3,
      topeAnual: 17595182.74,
      montoIdentificacion: 10000000,
      diasParaFacturar: 5,
    });
  });

  it("el CUIT se guarda solo con dígitos y tiene que ser válido", () => {
    expect(firstError({ cuit: "20111111113" })).toMatch(/CUIT no es válido/);
    expect(firstError({ cuit: "" })).toMatch(/CUIT no es válido/);
    const ok = parse({ cuit: "30500010912" });
    expect(ok.success && ok.data.cuit).toBe("30500010912");
  });

  it("los textos obligatorios no pueden quedar vacíos", () => {
    expect(firstError({ razonSocial: "   " })).toMatch(/razón social es obligatorio/);
    expect(firstError({ domicilioComercial: "" })).toMatch(/domicilio comercial es obligatorio/);
    expect(firstError({ iibb: "" })).toMatch(/Ingresos Brutos es obligatorio/);
  });

  it("la fecha de inicio de actividades tiene que ser una fecha", () => {
    expect(firstError({ inicioActividades: "" })).toMatch(/no es válida/);
    expect(firstError({ inicioActividades: "01/11/2026" })).toMatch(/no es válida/);
    expect(firstError({ inicioActividades: "2026-13-45" })).toMatch(/no es válida/);
  });

  it("el punto de venta: entero positivo de hasta 5 dígitos", () => {
    expect(firstError({ puntoDeVenta: "0" })).toMatch(/mayor a cero/);
    expect(firstError({ puntoDeVenta: "abc" })).toMatch(/número de hasta 5 dígitos/);
    expect(firstError({ puntoDeVenta: "123456" })).toMatch(/hasta 5 dígitos/);
    expect(firstError({ puntoDeVenta: "1.5" })).toMatch(/número de hasta 5 dígitos/);
  });

  it("el tope es opcional, pero si está tiene que ser un número no negativo", () => {
    const empty = parse({ topeAnual: "" });
    expect(empty.success && empty.data.topeAnual).toBeNull();
    const missing = parse({ topeAnual: undefined });
    expect(missing.success && missing.data.topeAnual).toBeNull();
    expect(firstError({ topeAnual: "-5" })).toMatch(/tope anual/);
    expect(firstError({ topeAnual: "mucho" })).toMatch(/tope anual/);
  });

  it("el monto de identificación: obligatorio y mayor a cero", () => {
    expect(firstError({ montoIdentificacion: "" })).toMatch(/mayor a cero/);
    expect(firstError({ montoIdentificacion: "0" })).toMatch(/mayor a cero/);
  });

  it("los días para facturar no pueden superar lo que acepta ARCA", () => {
    expect(parse({ diasParaFacturar: "0" }).success).toBe(true);
    expect(parse({ diasParaFacturar: "5" }).success).toBe(true);
    expect(firstError({ diasParaFacturar: "6" })).toMatch(/no acepta facturas de más de 5 días/);
    expect(firstError({ diasParaFacturar: "-1" })).toMatch(/número entero/);
    expect(firstError({ diasParaFacturar: "" })).toMatch(/número entero/);
  });
});

describe("parseAmount", () => {
  it("lee los formatos con los que se escribe un monto en Argentina", () => {
    expect(parseAmount("17.595.182,74")).toBe(17595182.74);
    expect(parseAmount("17595182,74")).toBe(17595182.74);
    expect(parseAmount("17595182.74")).toBe(17595182.74);
    expect(parseAmount("10.000.000")).toBe(10000000);
    expect(parseAmount("10.000")).toBe(10000);
    expect(parseAmount("1 500")).toBe(1500);
    expect(parseAmount("0,5")).toBe(0.5);
    expect(parseAmount("1234")).toBe(1234);
  });

  it("un punto con uno o dos decimales es decimal, no de miles", () => {
    expect(parseAmount("1234.5")).toBe(1234.5);
    expect(parseAmount("99.99")).toBe(99.99);
  });

  it("rechaza lo que no es un número", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
  });
});

describe("changedFields", () => {
  it("lista los campos que cambiaron, sin sus valores", () => {
    expect(changedFields({ cuit: "1", puntoDeVenta: 1, iibb: "x" }, { cuit: "1", puntoDeVenta: 2, iibb: "y" })).toEqual(["puntoDeVenta", "iibb"]);
  });

  it("sin datos previos, todo es nuevo", () => {
    expect(changedFields(null, { cuit: "1", iibb: "" })).toEqual(["cuit"]);
  });

  it("sin cambios devuelve una lista vacía", () => {
    expect(changedFields({ a: 1 }, { a: 1 })).toEqual([]);
  });
});
