"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "./nav-items";
import type { UserLike } from "@/lib/permissions";

type SideNavProps = {
  /** Datos serializables; el filtrado (con íconos) se hace acá, en cliente —
   * los íconos no se pueden pasar como prop desde un Server Component. */
  user: UserLike;
};

/** Barra lateral de navegación, para PC (la de caja y escritorio en general). */
export function SideNav({ user }: SideNavProps) {
  const pathname = usePathname();
  const items = visibleNavItems(user);

  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r p-3 sm:flex">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        if (!item.enabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/40"
            >
              <Icon className="size-4" />
              {item.label}
              <span className="ml-auto text-xs">pronto</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent",
              active ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
