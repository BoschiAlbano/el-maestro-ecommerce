"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";

export type ActionState = { error?: string };
export type QuickCreateRubroState = { error?: string; rubro?: { id: string; name: string } };

const nameSchema = z.string().trim().min(1, "El nombre es obligatorio.");

// Postgres no garantiza unicidad cuando parentId es NULL (dos NULL no son
// "iguales" para un UNIQUE constraint) — @@unique([name, parentId]) solo
// protege subrubros de verdad. Para rubros de primer nivel hay que chequear
// duplicados a mano, en la aplicación (ver specs/004/plan.md, sección 7).
async function existsSiblingWithName(name: string, parentId: string | null, excludeId?: string) {
  const existing = await prisma.rubro.findFirst({
    where: { name, parentId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return existing !== null;
}

export async function createRubro(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const parsedName = nameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Nombre inválido." };

  const parentIdRaw = formData.get("parentId");
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw !== "" && parentIdRaw !== "__none__"
      ? parentIdRaw
      : null;

  if (parentId) {
    const parent = await prisma.rubro.findUnique({ where: { id: parentId } });
    if (!parent) return { error: "El rubro padre elegido no existe." };
    if (parent.parentId) {
      return { error: "Un subrubro no puede tener otro subrubro adentro (máximo 2 niveles)." };
    }
  }

  if (await existsSiblingWithName(parsedName.data, parentId)) {
    return { error: "Ya existe un rubro con ese nombre en ese nivel." };
  }

  await prisma.rubro.create({ data: { name: parsedName.data, parentId } });

  revalidatePath("/rubros");
  return {};
}

/** Para crear un rubro de primer nivel sin salir del alta de un producto (specs/004). */
export async function quickCreateRubro(name: string): Promise<QuickCreateRubroState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nombre inválido." };

  if (await existsSiblingWithName(parsed.data, null)) {
    return { error: "Ya existe un rubro con ese nombre." };
  }

  const rubro = await prisma.rubro.create({ data: { name: parsed.data, parentId: null } });
  revalidatePath("/rubros");
  return { rubro: { id: rubro.id, name: rubro.name } };
}

export async function updateRubro(rubroId: string, name: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nombre inválido." };

  const current = await prisma.rubro.findUnique({ where: { id: rubroId } });
  if (!current) return { error: "El rubro no existe." };

  if (await existsSiblingWithName(parsed.data, current.parentId, rubroId)) {
    return { error: "Ya existe un rubro con ese nombre en ese nivel." };
  }

  await prisma.rubro.update({ where: { id: rubroId }, data: { name: parsed.data } });

  revalidatePath("/rubros");
  return {};
}

export async function deleteRubro(rubroId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const rubro = await prisma.rubro.findUnique({
    where: { id: rubroId },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!rubro) return { error: "El rubro no existe." };
  if (rubro._count.products > 0) {
    return { error: "No se puede borrar un rubro con productos asociados." };
  }
  if (rubro._count.children > 0) {
    return { error: "No se puede borrar un rubro con subrubros. Borrá los subrubros primero." };
  }

  await prisma.rubro.delete({ where: { id: rubroId } });
  revalidatePath("/rubros");
  return {};
}
