"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { usernameKey } from "@/lib/username";

export type LoginState = { error?: string };

const INVALID_CREDENTIALS = "Usuario o contraseña incorrectos.";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username.trim() || !password) {
    return { error: "Completá usuario y contraseña." };
  }

  // El usuario se traduce al email con el que está registrada la cuenta en
  // Supabase Auth (specs/016). Si no existe, el mensaje es el mismo que con una
  // contraseña incorrecta: no se revela si el usuario existe.
  const account = await prisma.user.findUnique({
    where: { usernameKey: usernameKey(username) },
    select: { email: true },
  });
  if (!account) {
    return { error: INVALID_CREDENTIALS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });

  if (error || !data.user) {
    return { error: INVALID_CREDENTIALS };
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
