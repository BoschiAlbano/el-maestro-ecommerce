"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner, type PermisoEspecial } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { ModuloNegocio } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string };

const nameSchema = z.string().trim().min(1, "El nombre del rol es obligatorio.");

const PERMISOS_ESPECIALES: PermisoEspecial[] = [
  "verCostosMargenes",
  "anularVentas",
  "ajustarStock",
  "reimprimirTickets",
  "cerrarCaja",
  "cambiarPrecios",
];

function parseMatrixAndSpecial(formData: FormData) {
  const matrix = Object.values(ModuloNegocio).map((module) => ({
    module,
    ver: formData.get(`perm_${module}_ver`) === "on",
    crear: formData.get(`perm_${module}_crear`) === "on",
    editar: formData.get(`perm_${module}_editar`) === "on",
    anular: formData.get(`perm_${module}_anular`) === "on",
    exportar: formData.get(`perm_${module}_exportar`) === "on",
  }));

  const special = Object.fromEntries(
    PERMISOS_ESPECIALES.map((p) => [p, formData.get(p) === "on"]),
  ) as Record<PermisoEspecial, boolean>;

  return { matrix, special };
}

export async function createRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const parsedName = nameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Nombre inválido." };
  }

  const { matrix, special } = parseMatrixAndSpecial(formData);

  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { name: parsedName.data, ...special, permissions: { create: matrix } },
      });
      await logAudit(tx, {
        userId: currentUser.id,
        action: "ROLE_CREATED",
        targetType: "Role",
        targetId: role.id,
        detail: { name: role.name },
      });
    });
  } catch {
    return { error: "Ya existe un rol con ese nombre." };
  }

  revalidatePath("/roles");
  revalidatePath("/configuracion/auditoria");
  redirect("/roles");
}

export async function updateRole(
  roleId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "El rol no existe." };
  if (role.isOwnerRole) return { error: "El rol Dueño no se puede editar." };

  const parsedName = nameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Nombre inválido." };
  }

  const { matrix, special } = parseMatrixAndSpecial(formData);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id: roleId }, data: { name: parsedName.data, ...special } });
      for (const m of matrix) {
        await tx.rolePermission.upsert({
          where: { roleId_module: { roleId, module: m.module } },
          update: m,
          create: { roleId, ...m },
        });
      }
      await logAudit(tx, {
        userId: currentUser.id,
        action: "ROLE_UPDATED",
        targetType: "Role",
        targetId: roleId,
        detail: { nombreViejo: role.name, nombreNuevo: parsedName.data },
      });
    });
  } catch {
    return { error: "Ya existe un rol con ese nombre." };
  }

  revalidatePath("/roles");
  revalidatePath("/configuracion/auditoria");
  redirect("/roles");
}

export async function deleteRole(roleId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return { error: "El rol no existe." };
  if (role.isOwnerRole) return { error: "El rol Dueño no se puede borrar." };
  if (role._count.users > 0) {
    return { error: "No se puede borrar un rol con usuarios asignados. Reasignalos primero." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id: roleId } });
    await logAudit(tx, {
      userId: currentUser.id,
      action: "ROLE_DELETED",
      targetType: "Role",
      targetId: roleId,
      detail: { name: role.name },
    });
  });

  revalidatePath("/roles");
  revalidatePath("/configuracion/auditoria");
  return {};
}
