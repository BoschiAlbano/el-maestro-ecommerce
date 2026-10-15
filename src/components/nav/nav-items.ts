import type { LucideIcon } from "lucide-react";
import { Home, ShoppingCart, Package, ClipboardList, Wallet, Users, Settings } from "lucide-react";
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
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, enabled: false },
  { href: "/stock", label: "Stock", icon: Package, enabled: false },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, enabled: false },
  { href: "/caja", label: "Caja", icon: Wallet, enabled: false },
  { href: "/usuarios", label: "Usuarios", icon: Users, enabled: true, ownerOnly: true },
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
