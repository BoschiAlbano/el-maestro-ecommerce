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

  // La fila en `users` la crea el dueño al dar de alta al usuario (spec 002,
  // Server Action `createUser`) — acá solo verificamos que exista y esté
  // activa. Si no, es una cuenta de Supabase Auth huérfana o desactivada:
  // no la dejamos pasar aunque la contraseña sea correcta.
  const user = await prisma.user.findUnique({ where: { authUserId: data.user.id } });

  if (!user || !user.active) {
    await supabase.auth.signOut();
    return {
      error: user
        ? "Tu usuario está desactivado. Hablá con el dueño."
        : "Tu cuenta no está configurada todavía. Hablá con el dueño.",
    };
  }

  redirect("/inicio");
}
