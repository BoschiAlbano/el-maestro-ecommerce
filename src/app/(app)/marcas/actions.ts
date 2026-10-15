"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";

export type ActionState = { error?: string };

const nameSchema = z.string().trim().min(1, "El nombre es obligatorio.");

export async function createBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nombre inválido." };

  try {
    await prisma.brand.create({ data: { name: parsed.data } });
  } catch {
    return { error: "Ya existe una marca con ese nombre." };
  }

  revalidatePath("/marcas");
  return {};
}

export async function updateBrand(brandId: string, name: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nombre inválido." };

  try {
    await prisma.brand.update({ where: { id: brandId }, data: { name: parsed.data } });
  } catch {
    return { error: "Ya existe una marca con ese nombre." };
  }

  revalidatePath("/marcas");
  return {};
}

export async function deleteBrand(brandId: string): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { _count: { select: { products: true } } },
  });
  if (!brand) return { error: "La marca no existe." };
  if (brand._count.products > 0) {
    return { error: "No se puede borrar una marca con productos asociados." };
  }

  await prisma.brand.delete({ where: { id: brandId } });
  revalidatePath("/marcas");
  return {};
}
