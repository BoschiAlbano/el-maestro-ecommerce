import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenCryptoError, decryptToken, encryptToken } from "./token-crypto";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");
const TOKEN = "APP_USR-1234567890-111111-abcdef-ñ-987654321";

describe("token-crypto", () => {
  it("descifra lo que cifró", () => {
    expect(decryptToken(encryptToken(TOKEN, KEY), KEY)).toBe(TOKEN);
  });

  it("el dato guardado no contiene el texto original", () => {
    expect(encryptToken(TOKEN, KEY)).not.toContain("APP_USR");
  });

  it("dos cifrados del mismo texto dan resultados distintos", () => {
    expect(encryptToken(TOKEN, KEY)).not.toBe(encryptToken(TOKEN, KEY));
  });

  it("falla con una clave equivocada", () => {
    expect(() => decryptToken(encryptToken(TOKEN, KEY), OTHER_KEY)).toThrow(TokenCryptoError);
  });

  it("falla si el dato guardado fue alterado", () => {
    const [version, iv, tag, encrypted] = encryptToken(TOKEN, KEY).split(".");
    const flipped = Buffer.from(encrypted, "base64url");
    flipped[0] ^= 0xff;
    const tampered = [version, iv, tag, flipped.toString("base64url")].join(".");
    expect(() => decryptToken(tampered, KEY)).toThrow(TokenCryptoError);
  });

  it("falla si el dato no tiene el formato esperado", () => {
    expect(() => decryptToken("texto-plano", KEY)).toThrow(TokenCryptoError);
    expect(() => decryptToken("v2.a.b.c", KEY)).toThrow(TokenCryptoError);
    expect(() => decryptToken("", KEY)).toThrow(TokenCryptoError);
  });

  it("falla cerrada si falta la clave o no mide 32 bytes", () => {
    expect(() => encryptToken(TOKEN, undefined)).toThrow(TokenCryptoError);
    expect(() => encryptToken(TOKEN, "")).toThrow(TokenCryptoError);
    expect(() => encryptToken(TOKEN, Buffer.from("corta").toString("base64"))).toThrow(TokenCryptoError);
    expect(() => decryptToken(encryptToken(TOKEN, KEY), undefined)).toThrow(TokenCryptoError);
  });

  it("el error no revela el contenido", () => {
    try {
      decryptToken(encryptToken(TOKEN, KEY), OTHER_KEY);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("APP_USR");
    }
  });
});
