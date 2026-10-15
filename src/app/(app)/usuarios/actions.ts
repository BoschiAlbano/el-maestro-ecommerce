"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string };

const createUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres."),
  roleId: z.string().min(1, "Elegí un rol."),
});

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { name, email, password, roleId } = parsed.data;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "El rol elegido no existe." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin esto, Supabase manda mail de confirmación y no puede loguear.
  });
  if (error || !data.user) {
    return {
      error: error?.code === "email_exists" ? "Ya existe un usuario con ese email." : "No se pudo crear el usuario.",
    };
  }
  const authUserId = data.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { authUserId, name, email, roleId } });
      await logAudit(tx, {
        userId: currentUser.id,
        action: "USER_CREATED",
        targetType: "User",
        targetId: user.id,
        detail: { name, email, rol: role.name },
      });
    });
  } catch {
    // No dejar un usuario de Supabase Auth huérfano si falla el guardado en Prisma.
    await admin.auth.admin.deleteUser(authUserId);
    return { error: "No se pudo guardar el usuario (¿email duplicado?)." };
  }

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  redirect("/usuarios");
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  roleId: z.string().min(1, "Elegí un rol."),
});

export async function updateUser(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { name, roleId } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) return { error: "El usuario no existe." };

  const cambiaRol = roleId !== target.roleId;

  if (cambiaRol && userId === currentUser.id) {
    return { error: "No podés cambiar tu propio rol." };
  }

  if (cambiaRol && target.role.isOwnerRole) {
    const duenosActivos = await prisma.user.count({
      where: { active: true, role: { isOwnerRole: true } },
    });
    if (duenosActivos <= 1) {
      return { error: "No podés cambiarle el rol al único Dueño activo." };
    }
  }

  const newRole = cambiaRol ? await prisma.role.findUnique({ where: { id: roleId } }) : target.role;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name, roleId } });
    await logAudit(tx, {
      userId: currentUser.id,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: userId,
      detail: {
        nombreViejo: target.name,
        nombreNuevo: name,
        rolViejo: target.role.name,
        rolNuevo: newRole?.name ?? target.role.name,
      },
    });
  });

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  redirect("/usuarios");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  if (!active) {
    if (userId === currentUser.id) {
      return { error: "No podés desactivarte a vos mismo." };
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (target?.role.isOwnerRole) {
      const duenosActivos = await prisma.user.count({
        where: { active: true, role: { isOwnerRole: true } },
      });
      if (duenosActivos <= 1) {
        return { error: "No podés desactivar al único Dueño activo." };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { active } });
    await logAudit(tx, {
      userId: currentUser.id,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      targetType: "User",
      targetId: userId,
      detail: { name: user.name, email: user.email },
    });
  });

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  return {};
}
