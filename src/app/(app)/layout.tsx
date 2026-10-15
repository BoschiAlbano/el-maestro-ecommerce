import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { AppShell } from "@/components/nav/app-shell";
import { UserMenu } from "@/components/nav/user-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const appUser = await getCurrentUser();

  // Sin middleware (ver riesgo en specs/001-base-del-proyecto/plan.md,
  // sección 7): este chequeo es la barrera real, no solo una segunda capa.
  // Cubre también el caso de `login/actions.ts`: sesión de Supabase válida
  // pero sin fila en `users`, o desactivada mientras tenía la sesión abierta.
  if (!appUser || !appUser.active) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell user={appUser} headerEnd={<UserMenu name={appUser.name} email={appUser.email} />}>
      {children}
    </AppShell>
  );
}
