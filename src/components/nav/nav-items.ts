import type { LucideIcon } from "lucide-react";
import { Home, ShoppingCart, Package, ClipboardList, Wallet, Users, IdCard, Settings, Tags, Truck } from "lucide-react";
// Desde "enums" (no desde "client"): ver nota en components/permission-matrix.tsx.
import { ModuloNegocio } from "@/generated/prisma/enums";
import { isOwner, hasPermission, type Accion, type UserLike } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = módulo todavía no construido (ver docs/PROJECT.md, sección 11). */
  enabled: boolean;
  /** true = solo visible para el rol Dueño (specs/002, sección 6). */
  ownerOnly?: boolean;
  /** Visible según la matriz de permisos del rol (specs/003, sección 6). */
  requiresPermission?: { module: ModuloNegocio; action: Accion };
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, enabled: true },
  {
    href: "/productos",
    label: "Productos",
    icon: Tags,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CATALOGO, action: "ver" },
  },
  {
    href: "/ventas",
    label: "Ventas",
    icon: ShoppingCart,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.VENTAS, action: "crear" },
  },
  {
    href: "/inventario",
    label: "Stock",
    icon: Package,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.INVENTARIO, action: "ver" },
  },
  {
    href: "/ingresos",
    label: "Ingresos",
    icon: Truck,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.INGRESO_MERCADERIA, action: "ver" },
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.PEDIDOS, action: "ver" },
  },
  {
    href: "/caja",
    label: "Caja",
    icon: Wallet,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CAJA, action: "ver" },
  },
  { href: "/usuarios", label: "Usuarios", icon: Users, enabled: true, ownerOnly: true },
  {
    href: "/empleados",
    label: "Empleados",
    icon: IdCard,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.EMPLEADOS, action: "ver" },
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CONFIGURACION, action: "ver" },
  },
];

/** Qué ítems de navegación puede ver este usuario, según su rol y permisos. */
export function visibleNavItems(user: UserLike): NavItem[] {
  return navItems.filter((item) => {
    if (item.ownerOnly && !isOwner(user)) return false;
    if (item.requiresPermission && !hasPermission(user, item.requiresPermission.module, item.requiresPermission.action)) {
      return false;
    }
    return true;
  });
}
