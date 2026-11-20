import { describe, expect, it } from "vitest";
import { ModuloNegocio } from "@/generated/prisma/enums";
import { canSeeNotificationType, presentNotification, typesToMarkRead, visibleNotificationTypes } from "./notification-types";
import type { UserLike } from "./permissions";

const SPECIALS = {
  verCostosMargenes: false,
  anularVentas: false,
  ajustarStock: false,
  reimprimirTickets: false,
  cerrarCaja: false,
  cambiarPrecios: false,
};

function userWith(modules: ModuloNegocio[], options: { owner?: boolean; active?: boolean; editar?: boolean } = {}): UserLike {
  return {
    active: options.active ?? true,
    role: {
      isOwnerRole: options.owner ?? false,
      ...SPECIALS,
      permissions: modules.map((module) => ({
        module,
        ver: true,
        crear: false,
        editar: options.editar ?? false,
        anular: false,
        exportar: false,
      })),
    },
  };
}

describe("avisos de la campanita por permiso", () => {
  it("el Dueño ve todos los tipos", () => {
    expect(visibleNotificationTypes(userWith([], { owner: true })).sort()).toEqual(
      ["DIFERENCIA_CAJA", "ML_CANCELACION", "ML_FRAUDE", "ML_PUBLICACION", "ML_RECONEXION", "ML_VENTA", "ML_VENTA_SIN_STOCK", "PEDIDO_NUEVO", "TOPE_FACTURACION"].sort(),
    );
  });

  it("cada tipo pide el permiso ver de su módulo", () => {
    expect(visibleNotificationTypes(userWith([ModuloNegocio.PEDIDOS]))).toEqual(["PEDIDO_NUEVO"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.CAJA]))).toEqual(["DIFERENCIA_CAJA"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.CONFIGURACION]))).toEqual(["ML_RECONEXION"]);
    expect(visibleNotificationTypes(userWith([ModuloNegocio.MERCADO_LIBRE])).sort()).toEqual(
      ["ML_CANCELACION", "ML_FRAUDE", "ML_PUBLICACION", "ML_RECONEXION", "ML_VENTA", "ML_VENTA_SIN_STOCK"].sort(),
    );
  });

  it("el aviso de reconexión de Mercado Libre lo ve quien ve Configuración o Mercado Libre (specs/013, sección 11)", () => {
    const cajero = userWith([ModuloNegocio.VENTAS, ModuloNegocio.CAJA, ModuloNegocio.PEDIDOS]);
    expect(canSeeNotificationType(cajero, "ML_RECONEXION")).toBe(false);
    expect(canSeeNotificationType(userWith([ModuloNegocio.MERCADO_LIBRE]), "ML_RECONEXION")).toBe(true);
    expect(canSeeNotificationType(userWith([ModuloNegocio.CONFIGURACION]), "ML_RECONEXION")).toBe(true);
  });

  it("quien no puede reconectar ve el aviso sin enlace y con «Avisale al Dueño»", () => {
    const message = "Se perdió la conexión con Mercado Libre.";
    expect(presentNotification(userWith([ModuloNegocio.MERCADO_LIBRE]), "ML_RECONEXION", message)).toEqual({
      message: "Se perdió la conexión con Mercado Libre. Avisale al Dueño para reconectarla.",
    });
    expect(presentNotification(userWith([ModuloNegocio.CONFIGURACION], { editar: true }), "ML_RECONEXION", message)).toEqual({
      message,
      href: "/configuracion?tab=mercadolibre",
    });
    expect(presentNotification(userWith([], { owner: true }), "ML_RECONEXION", message).href).toBe("/configuracion?tab=mercadolibre");
    expect(presentNotification(userWith([ModuloNegocio.MERCADO_LIBRE]), "ML_VENTA", "Venta.")).toEqual({ message: "Venta.", href: "/ordenes" });
  });

  it("«Marcar todas como leídas» marca solo los tipos de esa pestaña que el usuario ve (RF-11)", () => {
    const owner = userWith([], { owner: true });
    expect(typesToMarkRead(owner, "sistema").sort()).toEqual(["DIFERENCIA_CAJA", "PEDIDO_NUEVO", "TOPE_FACTURACION"]);
    expect(typesToMarkRead(owner, "mercadolibre").every((t) => t.startsWith("ML_"))).toBe(true);
    expect(typesToMarkRead(owner, "todos").length).toBe(visibleNotificationTypes(owner).length);
    // Sin permiso de Caja no marca diferencias de caja, aunque estén en la pestaña.
    expect(typesToMarkRead(userWith([ModuloNegocio.PEDIDOS]), "sistema")).toEqual(["PEDIDO_NUEVO"]);
    expect(typesToMarkRead(userWith([ModuloNegocio.PEDIDOS]), "mercadolibre")).toEqual([]);
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
