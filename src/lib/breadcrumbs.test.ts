import { describe, expect, it } from "vitest";
import { buildBreadcrumbs } from "./breadcrumbs";

describe("buildBreadcrumbs", () => {
  it("el inicio es solo la página actual", () => {
    expect(buildBreadcrumbs("/inicio")).toEqual([{ label: "Inicio" }]);
  });

  it("una sección de primer nivel", () => {
    expect(buildBreadcrumbs("/productos")).toEqual([{ label: "Productos" }]);
  });

  it("editar un producto vuelve a Productos", () => {
    expect(buildBreadcrumbs("/productos/abc-123")).toEqual([
      { label: "Productos", href: "/productos" },
      { label: "Editar" },
    ]);
  });

  it("un id en una sección que no se edita es un detalle", () => {
    expect(buildBreadcrumbs("/pedidos/abc-123")).toEqual([
      { label: "Pedidos", href: "/pedidos" },
      { label: "Detalle" },
    ]);
  });

  it("subpáginas con nombre propio enlazan hacia atrás", () => {
    expect(buildBreadcrumbs("/ventas/historial/abc-123")).toEqual([
      { label: "Ventas", href: "/ventas" },
      { label: "Historial", href: "/ventas/historial" },
      { label: "Detalle" },
    ]);
  });

  it("un id en el medio se omite", () => {
    expect(buildBreadcrumbs("/ventas/abc-123/ticket")).toEqual([
      { label: "Ventas", href: "/ventas" },
      { label: "Ticket" },
    ]);
  });

  it("marcas y rubros cuelgan de Productos", () => {
    expect(buildBreadcrumbs("/marcas")).toEqual([
      { label: "Productos", href: "/productos" },
      { label: "Marcas" },
    ]);
  });

  it("roles cuelga de Usuarios", () => {
    expect(buildBreadcrumbs("/roles/nuevo")).toEqual([
      { label: "Usuarios", href: "/usuarios" },
      { label: "Roles", href: "/roles" },
      { label: "Nuevo" },
    ]);
  });

  it("órdenes de Mercado Libre y su detalle (specs/022)", () => {
    expect(buildBreadcrumbs("/ordenes/abc")).toEqual([{ label: "Órdenes", href: "/ordenes" }, { label: "Detalle" }]);
  });

  it("publicaciones de Mercado Libre y su pantalla de vincular (specs/020)", () => {
    expect(buildBreadcrumbs("/publicaciones/vincular")).toEqual([
      { label: "Mercado Libre", href: "/publicaciones" },
      { label: "Vincular publicaciones" },
    ]);
  });
});
