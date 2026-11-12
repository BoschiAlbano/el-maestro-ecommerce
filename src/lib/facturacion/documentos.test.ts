import { describe, expect, it } from "vitest";
import { formatCuit, isValidCuit, isValidDni, onlyDigits, validateReceiverDocument } from "./documentos";

// CUIT de ejemplo, no de personas reales: el que usa la documentación de las
// bibliotecas de ARCA y uno armado para las pruebas.
const CUIT_OK = "20111111112";
const CUIT_OK_2 = "30500010912";

describe("onlyDigits", () => {
  it("quita guiones, puntos y espacios", () => {
    expect(onlyDigits("20-11111111-2")).toBe(CUIT_OK);
    expect(onlyDigits(" 20.111.111 ")).toBe("20111111");
  });
});

describe("isValidCuit", () => {
  it("acepta CUIT con dígito verificador correcto", () => {
    expect(isValidCuit(CUIT_OK)).toBe(true);
    expect(isValidCuit(CUIT_OK_2)).toBe(true);
  });

  it("acepta el formato con guiones", () => {
    expect(isValidCuit("20-11111111-2")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(isValidCuit("20111111113")).toBe(false);
    expect(isValidCuit("30500010913")).toBe(false);
  });

  it("rechaza un dígito cambiado en el medio", () => {
    expect(isValidCuit("20111211112")).toBe(false);
  });

  it("rechaza largos incorrectos y texto", () => {
    expect(isValidCuit("2011111111")).toBe(false);
    expect(isValidCuit("201111111122")).toBe(false);
    expect(isValidCuit("")).toBe(false);
    expect(isValidCuit("no es un cuit")).toBe(false);
  });

  it("rechaza la combinación cuyo verificador sería 10", () => {
    // 20-00000001-?: la suma es 2×5 + 1×2 = 12, con resto 1 al dividir por 11.
    // El verificador sería 10, que no es un dígito: ningún final lo hace válido.
    for (let last = 0; last <= 9; last++) {
      expect(isValidCuit(`2000000001${last}`)).toBe(false);
    }
  });
});

describe("isValidDni", () => {
  it("acepta 7 u 8 dígitos, con o sin puntos", () => {
    expect(isValidDni("12345678")).toBe(true);
    expect(isValidDni("1234567")).toBe(true);
    expect(isValidDni("12.345.678")).toBe(true);
  });

  it("rechaza otros largos", () => {
    expect(isValidDni("123456")).toBe(false);
    expect(isValidDni("123456789")).toBe(false);
    expect(isValidDni("")).toBe(false);
  });
});

describe("formatCuit", () => {
  it("le pone guiones", () => {
    expect(formatCuit(CUIT_OK)).toBe("20-11111111-2");
  });

  it("si no tiene 11 dígitos lo deja como vino", () => {
    expect(formatCuit("123")).toBe("123");
  });
});

describe("validateReceiverDocument", () => {
  it("Consumidor Final sin identificar: sin número", () => {
    expect(validateReceiverDocument("NONE", null)).toBeNull();
    expect(validateReceiverDocument("NONE", "")).toBeNull();
    expect(validateReceiverDocument("NONE", "12345678")).toMatch(/no lleva/);
  });

  it("DNI", () => {
    expect(validateReceiverDocument("DNI", "12345678")).toBeNull();
    expect(validateReceiverDocument("DNI", "123")).toMatch(/7 u 8/);
    expect(validateReceiverDocument("DNI", " ")).toMatch(/Ingresá/);
  });

  it("CUIT", () => {
    expect(validateReceiverDocument("CUIT", "20-11111111-2")).toBeNull();
    expect(validateReceiverDocument("CUIT", "20111111113")).toMatch(/no es válido/);
    expect(validateReceiverDocument("CUIT", undefined)).toMatch(/Ingresá/);
  });
});
