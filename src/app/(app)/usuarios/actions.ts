"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { checkUsername } from "@/lib/username-check";

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

  const usernameCheck = await checkUsername(String(formData.get("username") ?? ""));
  if ("error" in usernameCheck) return { error: usernameCheck.error };

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
      const user = await tx.user.create({
        data: { authUserId, name, email, username: usernameCheck.username, usernameKey: usernameCheck.usernameKey, roleId },
      });
      await logAudit(tx, {
        userId: currentUser.id,
        action: "USER_CREATED",
        targetType: "User",
        targetId: user.id,
        detail: { name, email, usuario: usernameCheck.username, rol: role.name },
      });
    });
  } catch {
    // No dejar un usuario de Supabase Auth huérfano si falla el guardado en Prisma.
    await admin.auth.admin.deleteUser(authUserId);
    return { error: "No se pudo guardar el usuario (¿usuario o email duplicado?)." };
  }

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  redirect("/usuarios");
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.string().trim().toLowerCase().email("Email inválido."),
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
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { name, email, roleId } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) return { error: "El usuario no existe." };

  const usernameCheck = await checkUsername(String(formData.get("username") ?? ""), userId);
  if ("error" in usernameCheck) return { error: usernameCheck.error };

  const cambiaRol = roleId !== target.roleId;
  const cambiaEmail = email !== target.email.toLowerCase();

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

  const admin = createAdminClient();

  if (cambiaEmail) {
    const enUso = await prisma.user.findUnique({ where: { email } });
    if (enUso && enUso.id !== userId) return { error: "Ya existe un usuario con ese email." };

    const { error } = await admin.auth.admin.updateUserById(target.authUserId, {
      email,
      email_confirm: true, // sin esto, Supabase manda un mail de confirmación y el email nuevo no sirve para loguear.
    });
    if (error) {
      return {
        error: error.code === "email_exists" ? "Ya existe un usuario con ese email." : "No se pudo cambiar el email.",
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { name, email, roleId, username: usernameCheck.username, usernameKey: usernameCheck.usernameKey },
      });
      await logAudit(tx, {
        userId: currentUser.id,
        action: "USER_UPDATED",
        targetType: "User",
        targetId: userId,
        detail: {
          nombreViejo: target.name,
          nombreNuevo: name,
          emailViejo: target.email,
          emailNuevo: email,
          usuarioViejo: target.username,
          usuarioNuevo: usernameCheck.username,
          rolViejo: target.role.name,
          rolNuevo: newRole?.name ?? target.role.name,
        },
      });
    });
  } catch {
    // Que Supabase Auth y Prisma no queden con emails distintos.
    if (cambiaEmail) await admin.auth.admin.updateUserById(target.authUserId, { email: target.email, email_confirm: true });
    return { error: "No se pudo guardar el usuario." };
  }

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  redirect("/usuarios");
}

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

export type PasswordActionState = { error?: string; success?: boolean };

/** El Dueño le fija una contraseña nueva a un usuario (specs/002, sección 4). */
export async function resetUserPassword(
  userId: string,
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "El usuario no existe." };

  const { error } = await createAdminClient().auth.admin.updateUserById(target.authUserId, {
    password: parsed.data.password,
  });
  if (error) return { error: "No se pudo cambiar la contraseña." };

  await prisma.$transaction(async (tx) => {
    await logAudit(tx, {
      userId: currentUser.id,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: userId,
      // Nunca se guarda la contraseña, solo que se cambió.
      detail: { name: target.name, email: target.email, usuario: target.username, motivo: "Cambio de contraseña" },
    });
  });

  revalidatePath("/configuracion/auditoria");
  return { success: true };
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
      detail: { name: user.name, email: user.email, usuario: user.username },
    });
  });

  revalidatePath("/usuarios");
  revalidatePath("/configuracion/auditoria");
  return {};
}
