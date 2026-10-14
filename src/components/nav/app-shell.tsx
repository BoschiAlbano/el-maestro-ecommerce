import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";

type AppShellProps = {
  children: ReactNode;
  /** Slot para el menú de usuario (email + cerrar sesión), lo completa T-008. */
  headerEnd?: ReactNode;
};

/** Layout base: header + navegación lateral (PC) / inferior (celular). */
export function AppShell({ children, headerEnd }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col sm:flex-row">
      <SideNav />
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="font-semibold">Importadora</span>
          {headerEnd}
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:pb-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
