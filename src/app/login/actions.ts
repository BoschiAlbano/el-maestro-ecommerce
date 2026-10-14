"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type LoginState = { error?: string };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos." };
  }

  // Primer login de este usuario de Supabase Auth: crea su fila en nuestra
  // tabla `users` si todavía no existe (spec 002 le agrega nombre/rol/permisos).
  await prisma.user.upsert({
    where: { authUserId: data.user.id },
    update: {},
    create: { authUserId: data.user.id },
  });

  redirect("/");
}
