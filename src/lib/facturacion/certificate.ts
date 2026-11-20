import { X509Certificate, createPrivateKey, generateKeyPairSync } from "node:crypto";
import forge from "node-forge";
import { isValidCuit, onlyDigits } from "./documentos";

// Certificado de ARCA cargado desde Configuración (specs/023, RF-2b a RF-2e).
// Sin base ni red: leer un certificado, comprobar que corresponde a una clave
// privada y armar el pedido de certificado que se presenta en ARCA.
//
// Ningún mensaje de error incluye la clave privada ni parte de ella.

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

export type CertificateInfo = {
  /** CUIT del titular, leído del certificado (11 dígitos). */
  cuit: string;
  validFrom: Date;
  validTo: Date;
  /** Nombre que el titular le dio al certificado en ARCA. */
  commonName: string | null;
};

/** Tope de tamaño de un archivo de certificado o clave: son textos de pocos KB. */
export const MAX_PEM_BYTES = 20_000;

function parseCertificate(pem: string): X509Certificate {
  if (!pem.includes("BEGIN CERTIFICATE")) {
    throw new CertificateError("El archivo no es un certificado. Tiene que ser el que devuelve ARCA (.crt o .pem).");
  }
  try {
    return new X509Certificate(pem);
  } catch {
    throw new CertificateError("No se pudo leer el certificado. Volvé a descargarlo de ARCA.");
  }
}

/** Lee CUIT y vigencia de un certificado. ARCA pone el CUIT en el titular como `serialNumber=CUIT 20111111112`. */
export function readCertificate(pem: string): CertificateInfo {
  const certificate = parseCertificate(pem);
  const cuit = /serialNumber=CUIT (\d{11})/i.exec(certificate.subject)?.[1];
  if (!cuit) {
    throw new CertificateError("El certificado no tiene un CUIT en su titular. No parece ser un certificado de ARCA.");
  }
  return {
    cuit,
    validFrom: new Date(certificate.validFrom),
    validTo: new Date(certificate.validTo),
    commonName: /(?:^|\n)CN=([^\n]+)/.exec(certificate.subject)?.[1] ?? null,
  };
}

/** ¿El certificado se emitió para esta clave privada? */
export function certificateMatchesKey(certificatePem: string, privateKeyPem: string): boolean {
  const certificate = parseCertificate(certificatePem);
  try {
    return certificate.checkPrivateKey(createPrivateKey(privateKeyPem));
  } catch {
    // Clave ilegible: no corresponde.
    return false;
  }
}

/**
 * Valida un certificado antes de guardarlo (RF-2c). Devuelve sus datos, o
 * lanza `CertificateError` con el motivo, en palabras para el Dueño.
 */
export function validateCertificate(input: {
  certificatePem: string;
  privateKeyPem: string;
  /** CUIT cargado en los datos del emisor. */
  expectedCuit: string;
  now: Date;
}): CertificateInfo {
  const info = readCertificate(input.certificatePem);

  if (info.validTo.getTime() <= input.now.getTime()) {
    throw new CertificateError("El certificado está vencido. Hay que pedir uno nuevo en ARCA.");
  }
  if (info.validFrom.getTime() > input.now.getTime()) {
    throw new CertificateError("El certificado todavía no está vigente.");
  }
  if (info.cuit !== onlyDigits(input.expectedCuit)) {
    throw new CertificateError(
      "El certificado es de otro CUIT. Tiene que ser el del CUIT cargado en los datos del emisor.",
    );
  }
  if (!certificateMatchesKey(input.certificatePem, input.privateKeyPem)) {
    throw new CertificateError(
      "El certificado no corresponde a la clave privada. Si generaste el pedido con el sistema, subí el certificado que ARCA devolvió para ese pedido.",
    );
  }
  return info;
}

/** Días que faltan para el vencimiento; negativo si ya venció. */
export function daysUntilExpiration(validTo: Date, now: Date): number {
  return Math.floor((validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export type CertificateRequest = {
  /** Clave privada nueva. Se guarda cifrada y no sale del servidor. */
  privateKeyPem: string;
  /** Pedido de certificado, para presentar en ARCA. Es público. */
  csrPem: string;
};

/** Los nombres del pedido van en ASCII simple: ARCA rechaza otros caracteres. */
function toAscii(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .trim();
}

/**
 * Genera una clave RSA de 2048 bits y el pedido de certificado con el titular
 * que pide ARCA: país, organización, nombre del certificado y CUIT. Equivale a
 * `openssl req -new -subj "/C=AR/O=…/CN=…/serialNumber=CUIT …"`.
 */
export function generateCertificateRequest(input: {
  cuit: string;
  /** Razón social del emisor. */
  organization: string;
  /** Nombre para identificar el certificado en ARCA. */
  commonName: string;
}): CertificateRequest {
  const cuit = onlyDigits(input.cuit);
  if (!isValidCuit(cuit)) {
    throw new CertificateError("Cargá primero un CUIT válido en los datos del emisor.");
  }
  const organization = toAscii(input.organization);
  const commonName = toAscii(input.commonName);
  if (!organization || !commonName) {
    throw new CertificateError("Cargá primero la razón social en los datos del emisor.");
  }

  // La clave se genera con el motor de Node (rápido y con buena aleatoriedad);
  // node-forge solo arma y firma el pedido.
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const request = forge.pki.createCertificationRequest();
  request.publicKey = forge.pki.publicKeyFromPem(publicKey);
  request.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: organization },
    { name: "commonName", value: commonName },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ]);
  request.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  return { privateKeyPem: privateKey, csrPem: forge.pki.certificationRequestToPem(request) };
}

/** Lee un pedido de certificado: sirve para mostrar qué se generó y para las pruebas. */
export function readCertificateRequest(csrPem: string): {
  cuit: string | null;
  organization: string | null;
  commonName: string | null;
  signatureValid: boolean;
} {
  let request: forge.pki.CertificateSigningRequest;
  try {
    request = forge.pki.certificationRequestFromPem(csrPem);
  } catch {
    throw new CertificateError("El archivo no es un pedido de certificado.");
  }
  // Se busca por nombre largo: `serialNumber` no tiene abreviatura en node-forge.
  const field = (name: string) => {
    const value = request.subject.getField({ name })?.value;
    return typeof value === "string" ? value : null;
  };
  return {
    cuit: /CUIT (\d{11})/.exec(field("serialNumber") ?? "")?.[1] ?? null,
    organization: field("organizationName"),
    commonName: field("commonName"),
    signatureValid: request.verify(),
  };
}
