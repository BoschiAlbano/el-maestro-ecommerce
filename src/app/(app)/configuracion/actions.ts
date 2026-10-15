"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { ModuloNegocio } from "@/generated/prisma/client";

export type ActionState = { error?: string; success?: boolean };

const settingsSchema = z.object({
  razonSocial: z.string().trim().min(1, "La razón social es obligatoria."),
  textoTicketAdicional: z.string().trim().optional(),
  stockMinimoDefault: z.coerce.number().int().min(0, "No puede ser negativo."),
});

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  const parsed = settingsSchema.safeParse({
    razonSocial: formData.get("razonSocial"),
    textoTicketAdicional: formData.get("textoTicketAdicional"),
    stockMinimoDefault: formData.get("stockMinimoDefault"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { razonSocial, textoTicketAdicional, stockMinimoDefault } = parsed.data;

  await prisma.setting.upsert({
    where: { id: "singleton" },
    update: { razonSocial, textoTicketAdicional, stockMinimoDefault },
    create: { id: "singleton", razonSocial, textoTicketAdicional, stockMinimoDefault },
  });

  revalidatePath("/configuracion");
  return { success: true };
}
