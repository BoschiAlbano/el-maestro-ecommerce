import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

// Sin middleware (ver riesgo en specs/001-base-del-proyecto/plan.md, sección 7):
// la protección de sesión vive en los Server Components — este chequeo evita
// que alguien ya logueado vea el formulario de login de nuevo.
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return <LoginForm />;
}
