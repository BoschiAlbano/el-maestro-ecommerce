"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { ModuloNegocio } from "@/generated/prisma/client";

export type ActionState = { error?: string; success?: boolean };

const ticketSchema = z.object({
  razonSocial: z.string().trim().min(1, "La razón social es obligatoria."),
  textoTicketAdicional: z.string().trim().optional(),
});

const articleSchema = z.object({
  stockMinimoDefault: z.coerce.number().int().min(0, "No puede ser negativo."),
});

/** Datos del ticket: razón social y texto adicional. */
export async function updateTicketSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  const parsed = ticketSchema.safeParse({
    razonSocial: formData.get("razonSocial"),
    textoTicketAdicional: formData.get("textoTicketAdicional"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { razonSocial, textoTicketAdicional } = parsed.data;

  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { razonSocial, textoTicketAdicional },
    create: { id: "singleton", razonSocial, textoTicketAdicional },
  });

  revalidatePath("/configuracion");
  return { success: true };
}

/** Parámetros de artículos: stock mínimo por defecto. */
export async function updateArticleSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  const parsed = articleSchema.safeParse({
    stockMinimoDefault: formData.get("stockMinimoDefault"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { stockMinimoDefault } = parsed.data;

  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { stockMinimoDefault },
    create: { id: "singleton", stockMinimoDefault },
  });

  revalidatePath("/configuracion");
  return { success: true };
}
