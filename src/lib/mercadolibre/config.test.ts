import { describe, expect, it } from "vitest";
import { isMlConfigured, readMlConfig } from "./config";
import { MlConfigError } from "./errors";

const COMPLETE = {
  ML_CLIENT_ID: "1234567890",
  ML_CLIENT_SECRET: "secreto-de-prueba",
  ML_REDIRECT_URI: "https://ejemplo.test/api/mercadolibre/callback",
  ML_TOKEN_ENCRYPTION_KEY: "clave-de-prueba",
};

describe("readMlConfig", () => {
  it("lee las cuatro variables", () => {
    expect(readMlConfig(COMPLETE)).toEqual({
      clientId: "1234567890",
      clientSecret: "secreto-de-prueba",
      redirectUri: "https://ejemplo.test/api/mercadolibre/callback",
      encryptionKey: "clave-de-prueba",
    });
  });

  it("recorta espacios", () => {
    expect(readMlConfig({ ...COMPLETE, ML_CLIENT_ID: " 1234567890 " }).clientId).toBe("1234567890");
  });

  it("falla cerrada si falta alguna, y nombra las que faltan", () => {
    expect(() => readMlConfig({})).toThrow(MlConfigError);
    expect(() => readMlConfig({ ...COMPLETE, ML_CLIENT_SECRET: "" })).toThrow(/ML_CLIENT_SECRET/);
    expect(() => readMlConfig({ ...COMPLETE, ML_CLIENT_SECRET: "   " })).toThrow(/ML_CLIENT_SECRET/);
    expect(() => readMlConfig({ ...COMPLETE, ML_CLIENT_ID: undefined, ML_REDIRECT_URI: undefined })).toThrow(
      /ML_CLIENT_ID, ML_REDIRECT_URI/,
    );
  });

  it("el mensaje de error nunca incluye valores", () => {
    try {
      readMlConfig({ ...COMPLETE, ML_CLIENT_ID: "" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("secreto-de-prueba");
      expect(String(error)).not.toContain("clave-de-prueba");
    }
  });

  it("exige https en la dirección de retorno", () => {
    expect(() => readMlConfig({ ...COMPLETE, ML_REDIRECT_URI: "http://localhost:3000/api/mercadolibre/callback" })).toThrow(
      /https/,
    );
  });
});

describe("isMlConfigured", () => {
  it("true con todo, false si falta algo", () => {
    expect(isMlConfigured(COMPLETE)).toBe(true);
    expect(isMlConfigured({ ...COMPLETE, ML_TOKEN_ENCRYPTION_KEY: undefined })).toBe(false);
    expect(isMlConfigured({})).toBe(false);
  });
});
