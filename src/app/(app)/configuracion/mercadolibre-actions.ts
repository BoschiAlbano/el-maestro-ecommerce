"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { requireOwner, requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { readMlConfig } from "@/lib/mercadolibre/config";
import { disconnectMl } from "@/lib/mercadolibre/connection";
import { mlResultPath } from "@/lib/mercadolibre/connection-result";
import { MlConfigError, MlRateLimitError, MlReconnectRequiredError, MlUnavailableError } from "@/lib/mercadolibre/errors";
import { runMaintenance } from "@/lib/mercadolibre/recovery";
import {
  ML_OAUTH_COOKIE,
  ML_OAUTH_COOKIE_MAX_AGE_SECONDS,
  buildAuthorizationUrl,
  encodeOAuthCookie,
  newOAuthAttempt,
} from "@/lib/mercadolibre/oauth";

export type MlActionState = { error?: string; success?: string };

/**
 * Empieza la conexión (specs/019, RF-2): guarda el valor de control y el
 * verificador en una cookie corta y lleva al Dueño a Mercado Libre. La vuelta
 * la atiende `GET /api/mercadolibre/callback`.
 */
export async function startMercadoLibreConnection(): Promise<void> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  let authorizationUrl: string;
  try {
    const config = readMlConfig();
    const attempt = newOAuthAttempt();

    const cookieStore = await cookies();
    cookieStore.set(ML_OAUTH_COOKIE, encodeOAuthCookie(attempt), {
      httpOnly: true,
      secure: true,
      // `lax`: el navegador la envía al volver desde Mercado Libre, que es
      // una navegación normal; `strict` no la enviaría.
      sameSite: "lax",
      path: "/api/mercadolibre/callback",
      maxAge: ML_OAUTH_COOKIE_MAX_AGE_SECONDS,
    });

    authorizationUrl = buildAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      attempt,
    });
  } catch (error) {
    if (!(error instanceof MlConfigError)) throw error;
    redirect(mlResultPath("sin_configurar"));
  }

  redirect(authorizationUrl);
}

/** Desconecta la cuenta (RF-6). Solo el Dueño. */
export async function disconnectMercadoLibre(): Promise<MlActionState> {
  const currentUser = await getCurrentUser();
  requireOwner(currentUser);

  try {
    const result = await disconnectMl(currentUser.id);
    revalidatePath("/configuracion");
    return result === "disconnected"
      ? { success: "La cuenta de Mercado Libre quedó desconectada." }
      : { error: "No hay ninguna cuenta conectada." };
  } catch (error) {
    console.error("[mercadolibre] falló la desconexión:", error instanceof Error ? error.name : "error");
    return { error: "No se pudo desconectar la cuenta. Probá de nuevo." };
  }
}

/**
 * "Buscar avisos pendientes" (RF-13): hace en el momento lo mismo que la
 * pasada diaria. Alcanza con permiso "editar" en Configuración.
 */
export async function fetchMissedNotifications(): Promise<MlActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  try {
    const summary = await runMaintenance();
    revalidatePath("/configuracion");
    if (summary.skipped) return { error: "No hay ninguna cuenta de Mercado Libre conectada." };

    const { process } = summary;
    const parts = [
      `${summary.saved} aviso(s) nuevo(s) recuperado(s)`,
      `${process.processed + process.noAction} procesado(s)`,
    ];
    if (process.discarded > 0) parts.push(`${process.discarded} descartado(s)`);
    if (process.failed > 0) parts.push(`${process.failed} fallido(s)`);
    if (process.stillPending > 0) parts.push(`${process.stillPending} pendiente(s)`);
    return { success: `${parts.join(", ")}.` };
  } catch (error) {
    if (error instanceof MlReconnectRequiredError) {
      return { error: "Hay que volver a conectar la cuenta de Mercado Libre." };
    }
    if (error instanceof MlUnavailableError || error instanceof MlRateLimitError) {
      return { error: error.message };
    }
    console.error("[mercadolibre] falló la búsqueda de avisos:", error instanceof Error ? error.name : "error");
    return { error: "No se pudieron buscar los avisos. Probá de nuevo." };
  }
}

/** Valores por defecto de las publicaciones nuevas (specs/025, RF-5). */
export async function savePublicationDefaults(input: {
  listingType: string;
  warrantyType: string | null;
  warrantyDays: number | null;
  localPickUp: boolean;
}): Promise<MlActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CONFIGURACION, "editar");

  const listingType = input.listingType === "gold_pro" ? "gold_pro" : input.listingType === "gold_special" ? "gold_special" : null;
  if (!listingType) return { error: "El tipo de publicación no es válido." };
  const warrantyType = input.warrantyType === "SELLER" || input.warrantyType === "FACTORY" ? input.warrantyType : null;
  if (input.warrantyType !== null && !warrantyType) return { error: "El tipo de garantía no es válido." };
  const days = warrantyType ? input.warrantyDays : null;
  if (warrantyType && !(Number.isInteger(days) && days! > 0 && days! <= 3650)) return { error: "Cargá los días de garantía." };

  const data = {
    mlDefaultListingType: listingType,
    mlDefaultWarrantyType: warrantyType,
    mlDefaultWarrantyDays: days,
    mlDefaultLocalPickUp: Boolean(input.localPickUp),
  };
  await prisma.setting.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/configuracion");
  return { success: "Listo: las publicaciones nuevas arrancan con estos valores." };
}
