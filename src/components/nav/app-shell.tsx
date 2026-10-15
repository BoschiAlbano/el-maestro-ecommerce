import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";

type AppShellProps = {
  children: ReactNode;
  /** Slot para el menú de usuario (nombre/email + cerrar sesión). */
  headerEnd?: ReactNode;
  /** specs/002, sección 6: qué ítems de navegación ownerOnly se muestran. */
  isOwner: boolean;
};

/** Layout base: header + navegación lateral (PC) / inferior (celular). */
export function AppShell({ children, headerEnd, isOwner }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col sm:flex-row">
      <SideNav isOwner={isOwner} />
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="font-semibold">Importadora</span>
          {headerEnd}
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:pb-4">{children}</main>
      </div>
      <BottomNav isOwner={isOwner} />
    </div>
  );
}
