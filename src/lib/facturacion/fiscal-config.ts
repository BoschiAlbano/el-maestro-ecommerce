import { isValidCuit, onlyDigits } from "./documentos";

// Qué falta para poder facturar (specs/023, RF-4). Función pura: la usan la
// pestaña de Configuración, para explicar qué falta, y el cobro, para ofrecer
// o no la opción de facturar.

export type FiscalConfigData = {
  razonSocial: string;
  cuit: string;
  domicilioComercial: string;
  iibb: string;
  inicioActividades: Date | null;
  puntoDeVenta: number | null;
};

/** Estado del certificado del ambiente con el que se factura. */
export type CertificateState = {
  loaded: boolean;
  /** CUIT leído del certificado. */
  cuit: string | null;
  expiresAt: Date | null;
} | null;

/**
 * Lista de lo que falta, en palabras para el Dueño. Vacía = se puede facturar.
 * `hasEncryptionKey` es si el servidor tiene la clave que cifra el certificado.
 */
export function missingForInvoicing(input: {
  config: FiscalConfigData | null;
  certificate: CertificateState;
  hasEncryptionKey: boolean;
  now: Date;
}): string[] {
  const missing: string[] = [];
  const { config, certificate } = input;

  if (!config?.razonSocial.trim()) missing.push("Cargar la razón social.");
  if (!config?.cuit.trim()) missing.push("Cargar el CUIT.");
  else if (!isValidCuit(config.cuit)) missing.push("El CUIT cargado no es válido.");
  if (!config?.domicilioComercial.trim()) missing.push("Cargar el domicilio comercial.");
  if (!config?.iibb.trim()) missing.push("Cargar el número de Ingresos Brutos.");
  if (!config?.inicioActividades) missing.push("Cargar la fecha de inicio de actividades.");
  if (!config?.puntoDeVenta || config.puntoDeVenta < 1) missing.push("Cargar el punto de venta.");

  if (!input.hasEncryptionKey) {
    missing.push("Falta configurar la clave de cifrado en el servidor. Avisale a quien administra el sistema.");
  }

  if (!certificate?.loaded) {
    missing.push("Cargar el certificado de ARCA.");
  } else {
    if (certificate.expiresAt && certificate.expiresAt.getTime() <= input.now.getTime()) {
      missing.push("El certificado de ARCA está vencido. Hay que cargar uno nuevo.");
    }
    if (config?.cuit && isValidCuit(config.cuit) && certificate.cuit !== onlyDigits(config.cuit)) {
      missing.push("El certificado de ARCA es de otro CUIT que el cargado en los datos del emisor.");
    }
  }

  return missing;
}

export function canInvoice(input: Parameters<typeof missingForInvoicing>[0]): boolean {
  return missingForInvoicing(input).length === 0;
}
