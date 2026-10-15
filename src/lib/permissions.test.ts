import { describe, expect, it } from "vitest";
import { ModuloNegocio } from "@/generated/prisma/client";
import {
  PermissionError,
  hasPermission,
  hasSpecialPermission,
  isOwner,
  requireOwner,
  requirePermission,
  requireSpecialPermission,
  type UserLike,
} from "./permissions";

function makeUser(overrides: Partial<UserLike> = {}): UserLike {
  return {
    active: true,
    role: {
      isOwnerRole: false,
      verCostosMargenes: false,
      anularVentas: false,
      ajustarStock: false,
      reimprimirTickets: false,
      cerrarCaja: false,
      cambiarPrecios: false,
      permissions: [],
    },
    ...overrides,
  };
}

const dueno = makeUser({ role: { ...makeUser().role, isOwnerRole: true } });

describe("isOwner / requireOwner", () => {
  it("el Dueño es owner", () => {
    expect(isOwner(dueno)).toBe(true);
    expect(() => requireOwner(dueno)).not.toThrow();
  });

  it("un rol que no es Dueño, no es owner", () => {
    const empleado = makeUser();
    expect(isOwner(empleado)).toBe(false);
    expect(() => requireOwner(empleado)).toThrow(PermissionError);
  });

  it("un Dueño inactivo (desactivado) no pasa", () => {
    const duenoInactivo = makeUser({ active: false, role: { ...dueno.role } });
    expect(isOwner(duenoInactivo)).toBe(false);
    expect(() => requireOwner(duenoInactivo)).toThrow(PermissionError);
  });

  it("requireOwner(null) falla (sin sesión)", () => {
    expect(() => requireOwner(null)).toThrow(PermissionError);
  });
});

describe("hasPermission / requirePermission (matriz por módulo)", () => {
  it("el Dueño puede todo, aunque la matriz esté vacía", () => {
    expect(hasPermission(dueno, ModuloNegocio.VENTAS, "anular")).toBe(true);
  });

  it("un rol con el permiso marcado en la matriz, puede", () => {
    const cajero = makeUser({
      role: { ...makeUser().role, permissions: [{ module: ModuloNegocio.VENTAS, ver: true, crear: true, editar: false, anular: false, exportar: false }] },
    });
    expect(hasPermission(cajero, ModuloNegocio.VENTAS, "ver")).toBe(true);
    expect(hasPermission(cajero, ModuloNegocio.VENTAS, "crear")).toBe(true);
  });

  it("un rol sin el permiso marcado, no puede", () => {
    const cajero = makeUser({
      role: { ...makeUser().role, permissions: [{ module: ModuloNegocio.VENTAS, ver: true, crear: true, editar: false, anular: false, exportar: false }] },
    });
    expect(hasPermission(cajero, ModuloNegocio.VENTAS, "anular")).toBe(false);
    expect(() => requirePermission(cajero, ModuloNegocio.VENTAS, "anular")).toThrow(PermissionError);
  });

  it("un rol sin fila para ese módulo, no puede nada ahí", () => {
    const cajero = makeUser();
    expect(hasPermission(cajero, ModuloNegocio.CONFIGURACION, "ver")).toBe(false);
  });

  it("un usuario inactivo no puede, aunque la matriz diga que sí", () => {
    const inactivo = makeUser({
      active: false,
      role: { ...makeUser().role, permissions: [{ module: ModuloNegocio.VENTAS, ver: true, crear: true, editar: true, anular: true, exportar: true }] },
    });
    expect(hasPermission(inactivo, ModuloNegocio.VENTAS, "ver")).toBe(false);
  });
});

describe("hasSpecialPermission / requireSpecialPermission", () => {
  it("el Dueño tiene todos los permisos especiales", () => {
    expect(hasSpecialPermission(dueno, "verCostosMargenes")).toBe(true);
    expect(hasSpecialPermission(dueno, "cerrarCaja")).toBe(true);
  });

  it("un rol sin el permiso especial, no lo tiene", () => {
    const cajero = makeUser();
    expect(hasSpecialPermission(cajero, "anularVentas")).toBe(false);
    expect(() => requireSpecialPermission(cajero, "anularVentas")).toThrow(PermissionError);
  });

  it("un rol con el permiso especial marcado, lo tiene", () => {
    const encargado = makeUser({ role: { ...makeUser().role, ajustarStock: true } });
    expect(hasSpecialPermission(encargado, "ajustarStock")).toBe(true);
    expect(() => requireSpecialPermission(encargado, "ajustarStock")).not.toThrow();
  });
});
