import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import type { UserLike } from "@/lib/permissions";

type AppShellProps = {
  children: ReactNode;
  /** Slot para el menú de usuario (nombre/email + cerrar sesión). */
  headerEnd?: ReactNode;
  /** Datos serializables — el filtrado de nav (con íconos) es cosa del cliente. */
  user: UserLike;
};

/** Layout base: header + navegación lateral (PC) / inferior (celular). */
export function AppShell({ children, headerEnd, user }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col sm:flex-row">
      <div className="print:hidden">
        <SideNav user={user} />
      </div>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 print:hidden">
          <span className="font-semibold">Importadora</span>
          {headerEnd}
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:pb-4 print:p-0">{children}</main>
      </div>
      <div className="print:hidden">
        <BottomNav user={user} />
      </div>
    </div>
  );
}
