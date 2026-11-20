import "server-only";
import { credentialDeps, hasArcaEncryptionKey } from "./credential-repo";
import { canUseRealEnvironment, getStatus, type FiscalEnvironment } from "./credential-service";
import { dateOnly } from "./fechas";
import { MAX_DIAS_PARA_FACTURAR } from "./fiscal-schema";
import { loadInvoicingAvailability } from "./invoices";

// Lo que la pestaña Configuración > Facturación necesita, ya listo para
// mostrar y sin nada sensible: de los certificados solo el estado (nunca la
// clave), y el pedido pendiente, que es público.

export type CertificateView = {
  hasCertificate: boolean;
  cuit: string | null;
  /** AAAA-MM-DD. */
  expiresAt: string | null;
  daysLeft: number | null;
  hasPendingRequest: boolean;
  pendingCsrPem: string | null;
};

export type FacturacionView = {
  config: {
    razonSocial: string;
    cuit: string;
    domicilioComercial: string;
    iibb: string;
    /** AAAA-MM-DD, o vacío. */
    inicioActividades: string;
    puntoDeVenta: string;
    topeAnual: string;
    montoIdentificacion: string;
    diasParaFacturar: number;
    environment: FiscalEnvironment;
  };
  certificates: Record<FiscalEnvironment, CertificateView>;
  /** Lo que falta para poder facturar, en palabras. Vacío = listo. */
  missing: string[];
  hasEncryptionKey: boolean;
  canUseReal: boolean;
  maxDiasParaFacturar: number;
};

async function certificateView(environment: FiscalEnvironment): Promise<CertificateView> {
  const status = await getStatus(credentialDeps(), environment);
  return {
    hasCertificate: status.hasCertificate,
    cuit: status.cuit,
    expiresAt: status.expiresAt ? dateOnly(status.expiresAt) : null,
    daysLeft: status.daysLeft,
    hasPendingRequest: status.hasPendingRequest,
    pendingCsrPem: status.pendingCsrPem,
  };
}

/** Un número como se escribe en Argentina: coma decimal y sin separador de miles. */
function amountText(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

export async function loadFacturacionView(): Promise<FacturacionView> {
  const availability = await loadInvoicingAvailability();
  const { config } = availability;
  const [homologacion, produccion] = await Promise.all([certificateView("HOMOLOGACION"), certificateView("PRODUCCION")]);
  return {
    config: {
      razonSocial: config.razonSocial,
      cuit: config.cuit,
      domicilioComercial: config.domicilioComercial,
      iibb: config.iibb,
      inicioActividades: config.inicioActividades ? dateOnly(config.inicioActividades) : "",
      puntoDeVenta: config.puntoDeVenta === null ? "" : String(config.puntoDeVenta),
      topeAnual: amountText(config.topeAnual),
      montoIdentificacion: amountText(config.montoIdentificacion),
      diasParaFacturar: config.diasParaFacturar,
      environment: config.environment,
    },
    certificates: { HOMOLOGACION: homologacion, PRODUCCION: produccion },
    missing: availability.missing,
    hasEncryptionKey: hasArcaEncryptionKey(),
    canUseReal: canUseRealEnvironment(process.env.VERCEL_ENV),
    maxDiasParaFacturar: MAX_DIAS_PARA_FACTURAR,
  };
}
