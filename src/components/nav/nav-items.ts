import type { LucideIcon } from "lucide-react";
import { Home, ShoppingCart, Package, ClipboardList, Wallet, Users } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = módulo todavía no construido (ver docs/PROJECT.md, sección 11). */
  enabled: boolean;
  /** true = solo visible para el rol Dueño (specs/002, sección 6). */
  ownerOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, enabled: true },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, enabled: false },
  { href: "/stock", label: "Stock", icon: Package, enabled: false },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, enabled: false },
  { href: "/caja", label: "Caja", icon: Wallet, enabled: false },
  { href: "/usuarios", label: "Usuarios", icon: Users, enabled: true, ownerOnly: true },
];
