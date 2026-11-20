import "server-only";
import { prisma } from "@/lib/prisma";
import type { FiscalConfigData } from "./fiscal-config";

// Los datos fiscales del emisor (`fiscal_config`, fila única; specs/023).

export type FiscalConfigView = FiscalConfigData & {
  environment: "HOMOLOGACION" | "PRODUCCION";
  topeAnual: number | null;
  montoIdentificacion: number;
  diasParaFacturar: number;
};

export async function getFiscalConfig(): Promise<FiscalConfigView> {
  // La fila se crea vacía la primera vez: nadie tiene que sembrarla.
  const row = await prisma.fiscalConfig.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  return {
    razonSocial: row.razonSocial,
    cuit: row.cuit,
    domicilioComercial: row.domicilioComercial,
    iibb: row.iibb,
    inicioActividades: row.inicioActividades,
    puntoDeVenta: row.puntoDeVenta,
    environment: row.environment,
    topeAnual: row.topeAnual?.toNumber() ?? null,
    montoIdentificacion: row.montoIdentificacion.toNumber(),
    diasParaFacturar: row.diasParaFacturar,
  };
}
