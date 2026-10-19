"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { logout } from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** "Cerrar sesión" al pie del menú lateral, con confirmación antes de salir. */
export function LogoutButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Cerrar sesión" onClick={() => setOpen(true)}>
            <LogOut />
            <span>Cerrar sesión</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir del sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a cerrar tu sesión. Para volver a entrar tendrás que iniciar sesión de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => startTransition(() => logout())}>
              {pending ? "Saliendo…" : "Sí, salir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
