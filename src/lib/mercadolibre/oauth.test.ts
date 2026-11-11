import { describe, expect, it } from "vitest";
import {
  ML_AUTHORIZATION_URL,
  buildAuthorizationUrl,
  decodeOAuthCookie,
  encodeOAuthCookie,
  isSameState,
  newOAuthAttempt,
  pkceChallenge,
} from "./oauth";

describe("newOAuthAttempt", () => {
  it("genera valores distintos en cada intento", () => {
    const a = newOAuthAttempt();
    const b = newOAuthAttempt();
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
  });

  it("el verificador cumple el largo que pide PKCE (43 a 128 caracteres)", () => {
    const { verifier } = newOAuthAttempt();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("pkceChallenge", () => {
  it("coincide con el ejemplo de la especificación de PKCE (RFC 7636, apéndice B)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("buildAuthorizationUrl", () => {
  const attempt = { state: "abc123", verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" };
  const url = new URL(
    buildAuthorizationUrl({
      clientId: "1234567890",
      redirectUri: "https://ejemplo.test/api/mercadolibre/callback",
      attempt,
    }),
  );

  it("apunta a la autorización de Mercado Libre Argentina", () => {
    expect(`${url.origin}${url.pathname}`).toBe(ML_AUTHORIZATION_URL);
  });

  it("lleva todos los parámetros", () => {
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "1234567890",
      redirect_uri: "https://ejemplo.test/api/mercadolibre/callback",
      state: "abc123",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
    });
  });

  it("nunca incluye el verificador", () => {
    expect(url.toString()).not.toContain(attempt.verifier);
  });
});

describe("cookie del intento", () => {
  it("ida y vuelta", () => {
    const attempt = newOAuthAttempt();
    expect(decodeOAuthCookie(encodeOAuthCookie(attempt))).toEqual(attempt);
  });

  it("devuelve null si falta o está mal formada", () => {
    expect(decodeOAuthCookie(undefined)).toBeNull();
    expect(decodeOAuthCookie("")).toBeNull();
    expect(decodeOAuthCookie("sin-separador")).toBeNull();
    expect(decodeOAuthCookie(".solo-verificador")).toBeNull();
    expect(decodeOAuthCookie("solo-estado.")).toBeNull();
  });
});

describe("isSameState", () => {
  it("acepta el mismo valor", () => {
    expect(isSameState("abc123", "abc123")).toBe(true);
  });

  it("rechaza un valor distinto, aunque tenga otro largo", () => {
    expect(isSameState("abc123", "abc124")).toBe(false);
    expect(isSameState("abc123", "abc")).toBe(false);
  });

  it("falla cerrada si falta cualquiera de los dos", () => {
    expect(isSameState(undefined, "abc123")).toBe(false);
    expect(isSameState("abc123", null)).toBe(false);
    expect(isSameState("abc123", undefined)).toBe(false);
    expect(isSameState("", "")).toBe(false);
  });
});
