import type { ReactNode } from "react";
import { AppBreadcrumb } from "./app-breadcrumb";
import { AppSidebar } from "./app-sidebar";
import { NotificationsBell } from "./notifications-bell";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { UserLike } from "@/lib/permissions";

type AppShellProps = {
  children: ReactNode;
  /** Slot para el menú de usuario (nombre/email). */
  headerEnd?: ReactNode;
  /** Datos serializables — el filtrado de nav (con íconos) es cosa del cliente. */
  user: UserLike;
};

/** Layout base: barra lateral (PC) / cajón deslizable (celular, lo resuelve el propio Sidebar) + header. */
export function AppShell({ children, headerEnd, user }: AppShellProps) {
  return (
    <SidebarProvider className="print:block">
      <div className="print:hidden">
        <AppSidebar user={user} />
      </div>
      <SidebarInset className="print:m-0 print:shadow-none">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 print:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <AppBreadcrumb />
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            {headerEnd}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 print:p-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
