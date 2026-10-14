import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { UserMenu } from "@/components/nav/user-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya protege las rutas; este chequeo es una segunda barrera
  // del lado del servidor (constitución, regla 14) — no alcanza con confiar
  // en el middleware solo.
  if (!user) {
    redirect("/login");
  }

  return <AppShell headerEnd={<UserMenu />}>{children}</AppShell>;
}
