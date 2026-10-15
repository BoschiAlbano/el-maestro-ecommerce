import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/nav/app-shell";
import { UserMenu } from "@/components/nav/user-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // El middleware ya protege las rutas; este chequeo es una segunda barrera
  // del lado del servidor (constitución, regla 14) — no alcanza con confiar
  // en el middleware solo.
  if (!authUser) {
    redirect("/login");
  }

  const appUser = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { role: true },
  });

  // Mismo caso que en login/actions.ts: sesión de Supabase válida pero sin
  // fila en `users`, o desactivada mientras tenía la sesión abierta.
  if (!appUser || !appUser.active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      isOwner={appUser.role.isOwnerRole}
      headerEnd={<UserMenu name={appUser.name} email={appUser.email} />}
    >
      {children}
    </AppShell>
  );
}
