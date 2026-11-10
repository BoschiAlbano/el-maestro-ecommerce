import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

describe("isAuthorizedCron", () => {
  it("acepta Bearer con el secreto correcto", () => {
    expect(isAuthorizedCron("Bearer abc123", "abc123")).toBe(true);
  });

  it("rechaza un secreto equivocado", () => {
    expect(isAuthorizedCron("Bearer otro", "abc123")).toBe(false);
  });

  it("rechaza si falta el encabezado", () => {
    expect(isAuthorizedCron(null, "abc123")).toBe(false);
    expect(isAuthorizedCron("", "abc123")).toBe(false);
  });

  it("falla cerrada si el secreto no está definido o está vacío", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });

  it("rechaza un esquema distinto de Bearer", () => {
    expect(isAuthorizedCron("Basic abc123", "abc123")).toBe(false);
    expect(isAuthorizedCron("abc123", "abc123")).toBe(false);
    expect(isAuthorizedCron("bearer abc123", "abc123")).toBe(false);
  });

  it("rechaza secretos con distinto largo sin lanzar error", () => {
    expect(isAuthorizedCron("Bearer abc1234", "abc123")).toBe(false);
    expect(isAuthorizedCron("Bearer ab", "abc123")).toBe(false);
  });
});
