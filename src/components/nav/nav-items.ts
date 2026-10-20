import type { LucideIcon } from "lucide-react";
import { Home, ShoppingCart, Package, ClipboardList, Wallet, CalendarDays, Users, IdCard, Settings, Tags, Truck, BarChart3, ListChecks } from "lucide-react";
// Desde "enums" (no desde "client"): ver nota en components/permission-matrix.tsx.
import { ModuloNegocio } from "@/generated/prisma/enums";
import { isOwner, hasPermission, type Accion, type UserLike } from "@/lib/permissions";

/**
 * Agrupa la navegación para que se pueda escanear de un vistazo (specs de
 * UI/UX: "nav-hierarchy" — separar nav principal de la secundaria).
 * "principal" son además los únicos que entran en la barra inferior del
 * celular (máximo 4 + el botón "Más" — regla "bottom-nav-limit": máximo 5).
 */
export type NavGroup = "principal" | "catalogo" | "administracion";

export const NAV_GROUP_LABELS: Record<NavGroup, string | null> = {
  principal: null,
  catalogo: "Catálogo y stock",
  administracion: "Administración",
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** false = módulo todavía no construido (ver docs/PROJECT.md, sección 11). */
  enabled: boolean;
  /** true = solo visible para el rol Dueño (specs/002, sección 6). */
  ownerOnly?: boolean;
  /** Visible según la matriz de permisos del rol (specs/003, sección 6). */
  requiresPermission?: { module: ModuloNegocio; action: Accion };
};

export const navItems: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: Home, group: "principal", enabled: true },
  {
    href: "/ventas",
    label: "Ventas",
    icon: ShoppingCart,
    group: "principal",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.VENTAS, action: "crear" },
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ClipboardList,
    group: "principal",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.PEDIDOS, action: "ver" },
  },
  {
    href: "/caja",
    label: "Caja",
    icon: Wallet,
    group: "principal",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CAJA, action: "ver" },
  },
  {
    href: "/caja/dia",
    label: "Caja del día",
    icon: CalendarDays,
    group: "principal",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CAJA, action: "ver" },
  },
  {
    href: "/productos",
    label: "Productos",
    icon: Tags,
    group: "catalogo",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.CATALOGO, action: "ver" },
  },
  {
    href: "/inventario",
    label: "Stock",
    icon: Package,
    group: "catalogo",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.INVENTARIO, action: "ver" },
  },
  {
    href: "/lista-de-viaje",
    label: "Lista de viaje",
    icon: ListChecks,
    group: "catalogo",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.INVENTARIO, action: "ver" },
  },
  {
    href: "/ingresos",
    label: "Ingresos",
    icon: Truck,
    group: "catalogo",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.INGRESO_MERCADERIA, action: "ver" },
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: Users,
    group: "administracion",
    enabled: true,
    ownerOnly: true,
  },
  {
    href: "/empleados",
    label: "Empleados",
    icon: IdCard,
    group: "administracion",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.EMPLEADOS, action: "ver" },
  },
  {
    href: "/analiticas",
    label: "Analíticas",
    icon: BarChart3,
    group: "administracion",
    enabled: true,
    requiresPermission: { module: ModuloNegocio.ANALITICAS, action: "ver" },
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
    group: "administracion",
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

/** Ítems agrupados, en el orden de `navItems`, para pintar secciones con encabezado. */
export function groupedNavItems(items: NavItem[]): { group: NavGroup; items: NavItem[] }[] {
  const order: NavGroup[] = ["principal", "catalogo", "administracion"];
  return order
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);
}
