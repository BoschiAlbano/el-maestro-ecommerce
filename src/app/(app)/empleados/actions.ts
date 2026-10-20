"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireOwner } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { checkUsername } from "@/lib/username-check";

export type ActionState = { error?: string };

const employeeFieldsSchema = z.object({
  dni: z.string().trim().min(1, "El DNI es obligatorio."),
  phone: z.string().trim().optional(),
  hireDate: z.string().min(1, "La fecha de ingreso es obligatoria."),
  shift: z.enum(["MANANA", "TARDE"]),
});

async function assertDniAvailable(dni: string, excludeId?: string) {
  const existing = await prisma.employee.findUnique({ where: { dni } });
  if (existing && existing.id !== excludeId) {
    throw new Error("Ya hay un empleado con ese DNI.");
  }
}

const newUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.string().trim().email("Email inválido."),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres."),
  roleId: z.string().min(1, "Elegí un rol."),
});

export async function createEmployeeWithNewUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.EMPLEADOS, "crear");
  requireOwner(currentUser);

  const parsedUser = newUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
  });
  if (!parsedUser.success) return { error: parsedUser.error.issues[0]?.message ?? "Datos inválidos." };

  const parsedEmployee = employeeFieldsSchema.safeParse({
    dni: formData.get("dni"),
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate"),
    shift: formData.get("shift"),
  });
  if (!parsedEmployee.success) {
    return { error: parsedEmployee.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { name, email, password, roleId } = parsedUser.data;
  const { dni, phone, hireDate, shift } = parsedEmployee.data;

  const usernameCheck = await checkUsername(String(formData.get("username") ?? ""));
  if ("error" in usernameCheck) return { error: usernameCheck.error };

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "El rol elegido no existe." };

  try {
    await assertDniAvailable(dni);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo validar el DNI." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return {
      error: error?.code === "email_exists" ? "Ya existe un usuario con ese email." : "No se pudo crear el usuario.",
    };
  }
  const authUserId = data.user.id;

  let employeeId: string;
  try {
    employeeId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { authUserId, name, email, username: usernameCheck.username, usernameKey: usernameCheck.usernameKey, roleId },
      });
      const employee = await tx.employee.create({
        data: { userId: user.id, dni, phone, hireDate: new Date(hireDate), shift },
      });
      await logAudit(tx, {
        userId: currentUser.id,
        action: "USER_CREATED",
        targetType: "User",
        targetId: user.id,
        detail: { name, email, usuario: usernameCheck.username, rol: role.name, dni },
      });
      return employee.id;
    });
  } catch {
    // No dejar un usuario de Supabase Auth huérfano si falla el guardado en Prisma.
    await admin.auth.admin.deleteUser(authUserId);
    return { error: "No se pudo guardar el empleado (¿DNI, usuario o email duplicado?)." };
  }

  revalidatePath("/empleados");
  redirect(`/empleados/${employeeId}`);
}

const existingUserSchema = employeeFieldsSchema.extend({
  userId: z.string().min(1, "Elegí un usuario."),
});

export async function createEmployeeForExistingUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.EMPLEADOS, "crear");

  const parsed = existingUserSchema.safeParse({
    userId: formData.get("userId"),
    dni: formData.get("dni"),
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate"),
    shift: formData.get("shift"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { userId, dni, phone, hireDate, shift } = parsed.data;

  const existingEmployee = await prisma.employee.findUnique({ where: { userId } });
  if (existingEmployee) return { error: "Ese usuario ya tiene una ficha de empleado." };

  try {
    await assertDniAvailable(dni);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo validar el DNI." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "El usuario no existe." };

  const employee = await prisma.employee.create({
    data: { userId, dni, phone, hireDate: new Date(hireDate), shift },
  });

  revalidatePath("/empleados");
  redirect(`/empleados/${employee.id}`);
}

export async function updateEmployee(
  employeeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.EMPLEADOS, "editar");

  const parsed = employeeFieldsSchema.safeParse({
    dni: formData.get("dni"),
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate"),
    shift: formData.get("shift"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { dni, phone, hireDate, shift } = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "El empleado no existe." };

  try {
    await assertDniAvailable(dni, employeeId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo validar el DNI." };
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { dni, phone, hireDate: new Date(hireDate), shift },
  });

  revalidatePath(`/empleados/${employeeId}`);
  revalidatePath("/empleados");
  redirect(`/empleados/${employeeId}`);
}

export async function deactivateEmployee(employeeId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.EMPLEADOS, "anular");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { include: { role: true } } },
  });
  if (!employee) return { error: "El empleado no existe." };
  if (employee.terminatedAt) return { error: "Este empleado ya está dado de baja." };

  if (employee.user.role.isOwnerRole) {
    const duenosActivos = await prisma.user.count({
      where: { active: true, role: { isOwnerRole: true } },
    });
    if (duenosActivos <= 1) {
      return { error: "No podés dar de baja al único Dueño activo." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { terminatedAt: new Date() } });
    await tx.user.update({ where: { id: employee.userId }, data: { active: false } });
    await logAudit(tx, {
      userId: currentUser.id,
      action: "USER_DEACTIVATED",
      targetType: "User",
      targetId: employee.userId,
      detail: { name: employee.user.name, email: employee.user.email, usuario: employee.user.username, motivo: "Baja de empleado" },
    });
  });

  revalidatePath(`/empleados/${employeeId}`);
  revalidatePath("/empleados");
  revalidatePath("/usuarios");
  return {};
}
