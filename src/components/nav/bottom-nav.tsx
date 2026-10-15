"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

type BottomNavProps = {
  /** specs/002, sección 6: "Usuarios" solo lo ve el rol Dueño. */
  isOwner: boolean;
};

/** Barra de navegación inferior, para celular (regla 22: mobile-first). */
export function BottomNav({ isOwner }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background sm:hidden">
      {navItems
        .filter((item) => !item.ownerOnly || isOwner)
        .map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        if (!item.enabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground/40"
            >
              <Icon className="size-5" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
