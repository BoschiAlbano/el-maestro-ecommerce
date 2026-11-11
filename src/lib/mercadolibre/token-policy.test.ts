import { describe, expect, it } from "vitest";
import { REFRESH_MARGIN_MS, classifyRefreshError, expiresAtFrom, shouldRefresh } from "./token-policy";

const NOW = new Date("2026-11-11T15:00:00.000Z");
const inMs = (ms: number) => new Date(NOW.getTime() + ms);

describe("shouldRefresh", () => {
  it("no renueva si falta más que el margen", () => {
    expect(shouldRefresh(inMs(REFRESH_MARGIN_MS + 1), NOW)).toBe(false);
    expect(shouldRefresh(inMs(6 * 60 * 60 * 1000), NOW)).toBe(false);
  });

  it("renueva justo en el margen y por debajo", () => {
    expect(shouldRefresh(inMs(REFRESH_MARGIN_MS), NOW)).toBe(true);
    expect(shouldRefresh(inMs(1000), NOW)).toBe(true);
  });

  it("renueva si ya venció", () => {
    expect(shouldRefresh(inMs(-1), NOW)).toBe(true);
    expect(shouldRefresh(inMs(-24 * 60 * 60 * 1000), NOW)).toBe(true);
  });
});

describe("expiresAtFrom", () => {
  it("suma la vigencia en segundos (6 horas = 21600)", () => {
    expect(expiresAtFrom(NOW, 21600).toISOString()).toBe("2026-11-11T21:00:00.000Z");
  });
});

describe("classifyRefreshError", () => {
  // Respuestas reales de la prueba técnica del 2026-11-11.
  const REVOKED = {
    message: "Error validating grant. Your authorization code or refresh token may be expired or it was already used",
    error: "invalid_grant",
    status: 400,
    cause: [],
  };

  it("permiso revocado o vencido: definitivo", () => {
    expect(classifyRefreshError(400, REVOKED)).toBe("definitive");
  });

  it("otro error 400: pasajero", () => {
    expect(classifyRefreshError(400, { error: "invalid_request" })).toBe("transient");
    expect(classifyRefreshError(400, "texto")).toBe("transient");
    expect(classifyRefreshError(400, null)).toBe("transient");
  });

  it("clave de la aplicación mal cargada: pasajero (reconectar no lo arregla)", () => {
    expect(classifyRefreshError(401, { error: "invalid_client" })).toBe("transient");
  });

  it("límite de consultas y errores de Mercado Libre: pasajero", () => {
    expect(classifyRefreshError(429, { error: "too_many_requests" })).toBe("transient");
    expect(classifyRefreshError(500, null)).toBe("transient");
    expect(classifyRefreshError(503, "Service Unavailable")).toBe("transient");
  });

  it("sin respuesta (falla de red): pasajero", () => {
    expect(classifyRefreshError(null, undefined)).toBe("transient");
  });

  it("invalid_grant con otro código no cuenta como definitivo", () => {
    expect(classifyRefreshError(500, { error: "invalid_grant" })).toBe("transient");
  });
});
