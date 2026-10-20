import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Reservada para la tienda online (specs/015). Mientras tanto queda en blanco
// y fuera de los buscadores. Solo consulta la sesión de Supabase Auth, nunca
// la base de datos: quien ya tiene sesión sigue entrando al sistema por /inicio.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/inicio");
  }

  return null;
}
