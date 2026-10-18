"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { registerCashMovement } from "@/lib/cash";
import { computeExpectedCash } from "@/lib/cash-shift";
import { notifyDiferenciaCaja } from "@/lib/notifications";

export type ActionState = { error?: string };
export type PreviewCloseState = { error?: string; expected?: number; difference?: number };
export type ConfirmCloseState = { error?: string; closed?: boolean };

async function getOpenShift() {
  return prisma.cashShift.findFirst({ where: { closedAt: null } });
}

export async function openShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CAJA, "crear");

  const parsed = z.coerce
    .number()
    .min(0, "El monto inicial no puede ser negativo.")
    .safeParse(formData.get("openingAmount"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Monto inválido." };

  const existing = await getOpenShift();
  if (existing) return { error: "Ya hay una caja abierta. Cerrala antes de abrir otra." };

  await prisma.cashShift.create({
    data: { openingAmount: parsed.data, openedByUserId: currentUser.id },
  });

  revalidatePath("/caja");
  return {};
}

const movementSchema = z
  .object({
    type: z.enum(["INGRESO", "EGRESO"]),
    amount: z.coerce.number().positive("El monto tiene que ser mayor a cero."),
    concept: z.string().trim().min(1, "El concepto es obligatorio."),
    paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
    transferReference: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Tienen que ser 4 dígitos.")
      .optional(),
  })
  .refine((data) => data.paymentMethod !== "TRANSFERENCIA" || data.transferReference, {
    message: "Para transferencia, los últimos 4 dígitos del comprobante son obligatorios.",
    path: ["transferReference"],
  });

export async function registerMovement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CAJA, "crear");

  const parsed = movementSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    concept: formData.get("concept"),
    paymentMethod: formData.get("paymentMethod"),
    transferReference: formData.get("transferReference") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const shift = await getOpenShift();
  if (!shift) return { error: "No hay una caja abierta." };

  await prisma.$transaction((tx) =>
    registerCashMovement(tx, {
      shiftId: shift.id,
      type: parsed.data.type,
      amount: parsed.data.amount,
      concept: parsed.data.concept,
      paymentMethod: parsed.data.paymentMethod,
      transferReference:
        parsed.data.paymentMethod === "TRANSFERENCIA" ? parsed.data.transferReference : undefined,
      userId: currentUser.id,
    }),
  );

  revalidatePath("/caja");
  return {};
}

async function loadExpected(shiftId: string) {
  const shift = await prisma.cashShift.findUnique({ where: { id: shiftId } });
  if (!shift) return null;
  const movements = await prisma.cashMovement.findMany({ where: { shiftId } });
  const expected = computeExpectedCash(
    shift.openingAmount.toNumber(),
    movements.map((m) => ({
      type: m.type,
      amount: m.amount.toNumber(),
      paymentMethod: m.paymentMethod,
    })),
  );
  return { shift, expected };
}

export async function previewClose(countedCash: number): Promise<PreviewCloseState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CAJA, "editar");
  requireSpecialPermission(currentUser, "cerrarCaja");

  const shift = await getOpenShift();
  if (!shift) return { error: "No hay una caja abierta." };
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return { error: "El efectivo contado no puede ser negativo." };
  }

  const loaded = await loadExpected(shift.id);
  if (!loaded) return { error: "No hay una caja abierta." };

  return { expected: loaded.expected, difference: countedCash - loaded.expected };
}

export async function confirmClose(
  countedCash: number,
  differenceReason?: string,
): Promise<ConfirmCloseState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CAJA, "editar");
  requireSpecialPermission(currentUser, "cerrarCaja");

  const shift = await getOpenShift();
  if (!shift) return { error: "No hay una caja abierta." };

  // Se recalcula contra los movimientos actuales, no se confía en la
  // diferencia de la previsualización (mismo criterio que `confirmCount`,
  // specs/005): si algo cambió entre previsualizar y confirmar, importa el
  // estado real al momento de cerrar.
  const loaded = await loadExpected(shift.id);
  if (!loaded) return { error: "No hay una caja abierta." };

  const difference = countedCash - loaded.expected;
  if (difference !== 0 && !differenceReason?.trim()) {
    return { error: "Hay una diferencia: hace falta un motivo para poder cerrar." };
  }

  await prisma.cashShift.update({
    where: { id: shift.id },
    data: {
      closedAt: new Date(),
      countedCash,
      difference,
      differenceReason: difference !== 0 ? differenceReason!.trim() : undefined,
      closedByUserId: currentUser.id,
    },
  });

  if (difference !== 0) await notifyDiferenciaCaja(shift.id, difference);

  revalidatePath("/caja");
  revalidatePath("/caja/historial");
  return { closed: true };
}
