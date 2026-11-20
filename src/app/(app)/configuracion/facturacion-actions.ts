"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/permissions";
import { SecretBoxError } from "@/lib/secret-box";
import { openArcaSession } from "@/lib/facturacion/arca-session";
import { credentialDeps, hasArcaEncryptionKey } from "@/lib/facturacion/credential-repo";
import {
  CredentialError,
  assertCertificateText,
  assertPrivateKeyText,
  canUseRealEnvironment,
  generateRequest,
  getStatus,
  installFromPending,
  installWithKey,
  removeCertificate,
} from "@/lib/facturacion/credential-service";
import { getFiscalConfig } from "@/lib/facturacion/fiscal-data";
import { changedFields, fiscalConfigSchema } from "@/lib/facturacion/fiscal-schema";
import { ArcaError } from "@/lib/facturacion/gateway";

// Acciones de Configuración > Facturación (specs/023, RF-1 a RF-3 y RF-2b a
// RF-2e). TODAS son solo del Dueño y lo validan acá, en el servidor (constitución,
// regla 14): la pantalla solo oculta.

export type FacturacionState = { error?: string; success?: string };

const environmentSchema = z.enum(["HOMOLOGACION", "PRODUCCION"]);

/** Qué mostrar al usuario ante un error. Nunca el mensaje crudo de algo inesperado. */
function messageFor(error: unknown): string {
  if (error instanceof CredentialError || error instanceof ArcaError) return error.message;
  if (error instanceof SecretBoxError) {
    return "Falta configurar la clave de cifrado de ARCA en el servidor (ARCA_ENCRYPTION_KEY). Avisale a quien administra el sistema.";
  }
  console.error("[facturacion] error inesperado:", error instanceof Error ? error.name : "error");
  return "No se pudo completar la operación. Probá de nuevo.";
}

async function requireOwnerUser() {
  const user = await getCurrentUser();
  requireOwner(user);
  return user;
}

/** Datos del emisor (RF-1). */
export async function saveFiscalConfig(_prev: FacturacionState, formData: FormData): Promise<FacturacionState> {
  const user = await requireOwnerUser();

  const parsed = fiscalConfigSchema.safeParse({
    razonSocial: formData.get("razonSocial") ?? "",
    cuit: formData.get("cuit") ?? "",
    domicilioComercial: formData.get("domicilioComercial") ?? "",
    iibb: formData.get("iibb") ?? "",
    inicioActividades: formData.get("inicioActividades") ?? "",
    puntoDeVenta: formData.get("puntoDeVenta") ?? "",
    topeAnual: formData.get("topeAnual") ?? "",
    montoIdentificacion: formData.get("montoIdentificacion") ?? "",
    diasParaFacturar: formData.get("diasParaFacturar") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;

  const before = await getFiscalConfig();
  const fields = changedFields(
    { ...before, inicioActividades: before.inicioActividades?.toISOString().slice(0, 10) },
    data,
  );

  await prisma.$transaction(async (tx) => {
    const values = {
      razonSocial: data.razonSocial,
      cuit: data.cuit,
      domicilioComercial: data.domicilioComercial,
      iibb: data.iibb,
      inicioActividades: new Date(`${data.inicioActividades}T00:00:00.000Z`),
      puntoDeVenta: data.puntoDeVenta,
      topeAnual: data.topeAnual,
      montoIdentificacion: data.montoIdentificacion,
      diasParaFacturar: data.diasParaFacturar,
    };
    await tx.fiscalConfig.upsert({ where: { id: "singleton" }, update: values, create: { id: "singleton", ...values } });
    if (fields.length > 0) {
      await logAudit(tx, {
        userId: user.id,
        action: "FISCAL_CONFIG_UPDATED",
        targetType: "FiscalConfig",
        targetId: "singleton",
        // Solo los nombres de los campos: el detalle no necesita los valores.
        detail: { campos: fields },
      });
    }
  });

  revalidatePath("/configuracion");
  return { success: "Guardado." };
}

/**
 * Genera la clave y el pedido de certificado (RF-2b). Devuelve el pedido para
 * descargarlo: es público. La clave queda guardada cifrada y no sale.
 */
export async function generateCertificateRequestAction(
  environment: string,
): Promise<{ csr?: string; replaced?: boolean; error?: string }> {
  const user = await requireOwnerUser();
  const env = environmentSchema.safeParse(environment);
  if (!env.success) return { error: "Ambiente inválido." };

  try {
    const config = await getFiscalConfig();
    const { csrPem, replacedPending } = await generateRequest(credentialDeps(), {
      environment: env.data,
      cuit: config.cuit,
      razonSocial: config.razonSocial,
      userId: user.id,
    });
    revalidatePath("/configuracion");
    return { csr: csrPem, replaced: replacedPending };
  } catch (error) {
    return { error: messageFor(error) };
  }
}

/**
 * Carga el certificado (RF-2b). Solo el certificado, si hay un pedido
 * generado por el sistema; con el certificado y la clave, si ya existían.
 */
export async function uploadCertificate(_prev: FacturacionState, formData: FormData): Promise<FacturacionState> {
  const user = await requireOwnerUser();
  const env = environmentSchema.safeParse(formData.get("environment"));
  if (!env.success) return { error: "Ambiente inválido." };

  const certificateFile = formData.get("certificate");
  const keyFile = formData.get("privateKey");
  if (!(certificateFile instanceof File) || certificateFile.size === 0) {
    return { error: "Elegí el archivo del certificado que devolvió ARCA." };
  }

  try {
    const config = await getFiscalConfig();
    if (!config.cuit) return { error: "Cargá primero los datos del emisor, incluido el CUIT." };

    const certificatePem = assertCertificateText(await certificateFile.text());
    const deps = credentialDeps();
    const result =
      keyFile instanceof File && keyFile.size > 0
        ? await installWithKey(deps, {
            environment: env.data,
            certificatePem,
            privateKeyPem: assertPrivateKeyText(await keyFile.text()),
            expectedCuit: config.cuit,
            userId: user.id,
          })
        : await installFromPending(deps, { environment: env.data, certificatePem, expectedCuit: config.cuit, userId: user.id });

    revalidatePath("/configuracion");
    return {
      success: `Certificado cargado. Vence el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Tucuman" }).format(result.expiresAt)}.`,
    };
  } catch (error) {
    return { error: messageFor(error) };
  }
}

export async function removeCertificateAction(environment: string): Promise<FacturacionState> {
  const user = await requireOwnerUser();
  const env = environmentSchema.safeParse(environment);
  if (!env.success) return { error: "Ambiente inválido." };

  try {
    await removeCertificate(credentialDeps(), { environment: env.data, userId: user.id });
    revalidatePath("/configuracion");
    return { success: "Certificado quitado." };
  } catch (error) {
    return { error: messageFor(error) };
  }
}

/** Con qué certificado se factura: el de pruebas o el real (RF-2d). */
export async function setFiscalEnvironment(environment: string): Promise<FacturacionState> {
  const user = await requireOwnerUser();
  const env = environmentSchema.safeParse(environment);
  if (!env.success) return { error: "Ambiente inválido." };

  if (env.data === "PRODUCCION" && !canUseRealEnvironment(process.env.VERCEL_ENV)) {
    return { error: "El modo real solo se puede activar en el sitio publicado, no en un entorno de desarrollo o de prueba." };
  }
  const status = await getStatus(credentialDeps(), env.data);
  if (!status.hasCertificate) {
    return { error: "Cargá primero el certificado de ese ambiente." };
  }

  const before = await getFiscalConfig();
  if (before.environment === env.data) return { success: "Ya estaba en ese ambiente." };

  await prisma.$transaction(async (tx) => {
    await tx.fiscalConfig.update({ where: { id: "singleton" }, data: { environment: env.data } });
    await logAudit(tx, {
      userId: user.id,
      action: "FISCAL_CONFIG_UPDATED",
      targetType: "FiscalConfig",
      targetId: "singleton",
      detail: { campos: ["environment"], ambiente: env.data },
    });
  });

  revalidatePath("/configuracion");
  return { success: env.data === "PRODUCCION" ? "Ahora se factura con validez fiscal." : "Ahora se factura en modo de pruebas." };
}

/** «Probar conexión» (RF-3): estado del servicio de ARCA y último número autorizado. */
export async function testArcaConnection(): Promise<FacturacionState> {
  await requireOwnerUser();
  if (!hasArcaEncryptionKey()) return { error: messageFor(new SecretBoxError("sin clave")) };

  try {
    const session = await openArcaSession();
    const status = await session.gateway.status();
    if (!(status.app && status.db && status.auth)) {
      return { error: "ARCA informa que su servicio de facturación no está disponible ahora. Probá más tarde." };
    }
    const acquired = await session.ensureTicket();
    const last = await session.gateway.lastNumber(session.pointOfSale, 11);
    const ambiente = session.environment === "PRODUCCION" ? "real" : "de pruebas";
    return {
      success: `ARCA responde (ambiente ${ambiente}${acquired === "acquired" ? ", permiso nuevo obtenido" : ""}). Último número de factura C en el punto de venta ${session.pointOfSale}: ${last}.`,
    };
  } catch (error) {
    return { error: messageFor(error) };
  }
}
