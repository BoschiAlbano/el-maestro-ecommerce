import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Reservada para la tienda online (specs/015). Mientras tanto muestra un aviso
// de "en construcción" y queda fuera de los buscadores. Solo consulta la sesión de Supabase Auth, nunca
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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Tienda online en construcción
      </h1>
      <p className="max-w-md text-muted-foreground">
        Estamos preparando nuestra tienda. Muy pronto vas a poder comprar
        desde acá.
      </p>
    </main>
  );
}
