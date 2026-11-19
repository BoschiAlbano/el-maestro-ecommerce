import { describe, expect, it } from "vitest";
import { ModuloNegocio } from "@/generated/prisma/enums";
import { canSeeNotificationType, visibleNotificationTypes } from "./notification-types";
import type { UserLike } from "./permissions";

const SPECIALS = {
  verCostosMargenes: false,
  anularVentas: false,
  ajustarStock: false,
  reimprimirTickets: false,
  cerrarCaja: false,
  cambiarPrecios: false,
};

function userWith(modules: ModuloNegocio[], options: { owner?: boolean; active?: boolean } = {}): UserLike {
  return {
    active: options.active ?? true,
    role: {
      isOwnerRole: options.owner ?? false,
      ...SPECIALS,
      permissions: modules.map((module) => ({
        module,
        ver: true,
        crear: false,
        editar: false,
        anular: false,
        exportar: false,
      })),
    },
  };
}

describe("avisos de la campanita por permiso", () => {
  it("el Dueño ve todos los tipos", () => {
    expect(visibleNotificationTypes(userWith([], { owner: true })).sort()).toEqual(
      ["DIFERENCIA_CAJA", "ML_PUBLICACION", "ML_RECONEXION", "PEDIDO_NUEVO", "TOPE_FACTURACION"].sort(),
    );
  });

  it("cada tipo pide el permiso ver de su módulo", () => {
    expect(visibleNotificationTypes(userWith([ModuloNegocio.PEDIDOS]))).toEqual(["PEDIDO_NUEVO"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.CAJA]))).toEqual(["DIFERENCIA_CAJA"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.CONFIGURACION]))).toEqual(["ML_RECONEXION"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.MERCADO_LIBRE]))).toEqual(["ML_PUBLICACION"]);
  });

  it("el aviso de reconexión de Mercado Libre no lo ve quien no ve Configuración", () => {
    const cajero = userWith([ModuloNegocio.VENTAS, ModuloNegocio.CAJA, ModuloNegocio.PEDIDOS]);
    expect(canSeeNotificationType(cajero, "ML_RECONEXION")).toBe(false);
  });

  it("el aviso del tope de facturación es solo del Dueño, aunque el rol vea todos los módulos", () => {
    const todos = userWith(Object.values(ModuloNegocio));
    expect(canSeeNotificationType(todos, "TOPE_FACTURACION")).toBe(false);
    expect(visibleNotificationTypes(todos)).not.toContain("TOPE_FACTURACION");
    expect(canSeeNotificationType(userWith([], { owner: true }), "TOPE_FACTURACION")).toBe(true);
  });

  it("sin permisos no ve ninguno", () => {
    expect(visibleNotificationTypes(userWith([]))).toEqual([]);
  });

  it("un usuario inactivo no ve ninguno, aunque sea Dueño", () => {
    expect(visibleNotificationTypes(userWith([], { owner: true, active: false }))).toEqual([]);
  });
});
