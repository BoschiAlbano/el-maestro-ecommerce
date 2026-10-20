"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { validateResetConfirmation } from "@/lib/system-reset";
import { wipeBusinessData } from "@/lib/system-reset-data";

export type ResetState = {
  error?: string;
  /** Lo que quedó sin borrar fuera de la base (cuentas de acceso o fotos), si algo falló (RF-12). */
  leftovers?: string[];
};

const PHOTO_BUCKET = "product-photos";

/** Verifica la contraseña con un cliente aparte, para no tocar la sesión del Dueño. */
async function isPasswordCorrect(email: string, password: string): Promise<boolean> {
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  return !error && !!data.session;
}

/**
 * Borra las cuentas de acceso de Supabase Auth que no son la del Dueño. Se
 * recorre la lista de Auth (y no los usuarios de la base, que ya se borraron)
 * para que repetir el reinicio también limpie las cuentas que hayan quedado.
 * Devuelve cuántas no se pudieron borrar.
 */
async function deleteOtherAuthAccounts(keepAuthUserId: string): Promise<number> {
  const admin = createAdminClient();
  let failed = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return failed + 1;
    const others = data.users.filter((u) => u.id !== keepAuthUserId);
    if (others.length === 0) return failed;

    let deletedAny = false;
    for (const user of others) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) failed += 1;
      else deletedAny = true;
    }
    // Si no se pudo borrar ninguna, no tiene sentido volver a pedir la misma lista.
    if (!deletedAny) return failed;
  }
}

/** Borra todas las fotos del bucket; devuelve cuántas no se pudieron borrar. */
async function deleteAllPhotos(): Promise<string | null> {
  const storage = createAdminClient().storage.from(PHOTO_BUCKET);
  // Tope de vueltas por si el almacenamiento siguiera devolviendo archivos ya borrados.
  for (let round = 0; round < 100; round++) {
    const { data, error } = await storage.list("", { limit: 1000 });
    if (error) return "No se pudieron listar las fotos de productos.";
    const files = (data ?? []).filter((f) => f.id !== null);
    if (files.length === 0) return null;

    const { error: removeError } = await storage.remove(files.map((f) => f.name));
    if (removeError) return "No se pudieron borrar algunas fotos de productos.";
  }
  return "Quedaron fotos de productos sin borrar.";
}

/**
 * Borra todos los datos y deja solo al Dueño que lo ejecuta (specs/017).
 * Primero la base, en una transacción; después, lo que vive afuera.
 */
export async function resetSystem(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  const password = String(formData.get("password") ?? "");
  const phrase = String(formData.get("phrase") ?? "");

  const confirmationError = validateResetConfirmation({ password, phrase });
  if (confirmationError) return { error: confirmationError };

  if (!(await isPasswordCorrect(currentUser.email, password))) {
    return { error: "La contraseña es incorrecta. No se borró nada." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await wipeBusinessData(tx, currentUser.id);
        await logAudit(tx, {
          userId: currentUser.id,
          action: "SYSTEM_RESET",
          targetType: "System",
          targetId: "system",
          detail: { usuario: currentUser.username },
        });
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    // La transacción volvió atrás: no se borró nada. Queda el detalle en la consola del servidor.
    console.error("Falló el reinicio del sistema:", error);
    return { error: "No se pudo reiniciar el sistema. No se borró nada." };
  }

  // Lo de afuera no entra en la transacción: se junta lo que falle para informarlo.
  const leftovers: string[] = [];
  const failedAccounts = await deleteOtherAuthAccounts(currentUser.authUserId);
  if (failedAccounts > 0) {
    leftovers.push(`No se pudieron borrar ${failedAccounts} cuenta(s) de acceso.`);
  }
  const photoError = await deleteAllPhotos();
  if (photoError) leftovers.push(photoError);

  revalidatePath("/", "layout");
  if (leftovers.length > 0) {
    return { error: "El sistema se reinició, pero quedaron cosas sin borrar. Volvé a reiniciar para completarlo.", leftovers };
  }
  redirect("/inicio?reiniciado=1");
}
