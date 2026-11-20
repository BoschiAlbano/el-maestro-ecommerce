import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import {
  CertificateError,
  certificateMatchesKey,
  daysUntilExpiration,
  generateCertificateRequest,
  readCertificate,
  readCertificateRequest,
  validateCertificate,
} from "./certificate";

const CUIT = "20111111112";
const OTHER_CUIT = "30500010912";
const NOW = new Date("2026-11-11T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function newKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

/** Certificado de mentira con la forma de los de ARCA: el CUIT va en `serialNumber`. */
function fakeCertificate(options: {
  keys: { privateKey: string; publicKey: string };
  cuit?: string | null;
  validFrom?: Date;
  validTo?: Date;
}): string {
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.publicKeyFromPem(options.keys.publicKey);
  certificate.serialNumber = "01";
  certificate.validity.notBefore = options.validFrom ?? new Date(NOW.getTime() - 30 * DAY);
  certificate.validity.notAfter = options.validTo ?? new Date(NOW.getTime() + 700 * DAY);
  const subject: forge.pki.CertificateField[] = [
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: "Negocio de Prueba" },
    { name: "commonName", value: "sistema-de-prueba" },
  ];
  if (options.cuit !== null) subject.push({ name: "serialNumber", value: `CUIT ${options.cuit ?? CUIT}` });
  certificate.setSubject(subject);
  certificate.setIssuer([{ name: "commonName", value: "Autoridad de Prueba" }]);
  certificate.sign(forge.pki.privateKeyFromPem(options.keys.privateKey), forge.md.sha256.create());
  return forge.pki.certificateToPem(certificate);
}

// Generar claves RSA es lo lento de estas pruebas: se hacen una sola vez.
const keys = newKeyPair();
const otherKeys = newKeyPair();
const validPem = fakeCertificate({ keys });

describe("readCertificate", () => {
  it("lee el CUIT, la vigencia y el nombre", () => {
    const info = readCertificate(validPem);
    expect(info.cuit).toBe(CUIT);
    expect(info.commonName).toBe("sistema-de-prueba");
    expect(info.validTo.getTime()).toBeGreaterThan(NOW.getTime());
    expect(info.validFrom.getTime()).toBeLessThan(NOW.getTime());
  });

  it("rechaza un archivo que no es un certificado", () => {
    expect(() => readCertificate("hola")).toThrow(CertificateError);
    expect(() => readCertificate(keys.privateKey)).toThrow(/no es un certificado/);
    expect(() => readCertificate("-----BEGIN CERTIFICATE-----\nbasura\n-----END CERTIFICATE-----")).toThrow(
      CertificateError,
    );
  });

  it("rechaza un certificado sin CUIT en el titular", () => {
    expect(() => readCertificate(fakeCertificate({ keys, cuit: null }))).toThrow(/CUIT/);
  });
});

describe("certificateMatchesKey", () => {
  it("true con su propia clave", () => {
    expect(certificateMatchesKey(validPem, keys.privateKey)).toBe(true);
  });

  it("false con otra clave", () => {
    expect(certificateMatchesKey(validPem, otherKeys.privateKey)).toBe(false);
  });

  it("false con una clave ilegible", () => {
    expect(certificateMatchesKey(validPem, "no es una clave")).toBe(false);
  });
});

describe("validateCertificate", () => {
  const base = { certificatePem: validPem, privateKeyPem: keys.privateKey, expectedCuit: CUIT, now: NOW };

  it("acepta un certificado vigente, del CUIT del emisor y de su clave", () => {
    expect(validateCertificate(base).cuit).toBe(CUIT);
  });

  it("acepta el CUIT del emisor escrito con guiones", () => {
    expect(validateCertificate({ ...base, expectedCuit: "20-11111111-2" }).cuit).toBe(CUIT);
  });

  it("rechaza un certificado vencido", () => {
    const expired = fakeCertificate({
      keys,
      validFrom: new Date(NOW.getTime() - 800 * DAY),
      validTo: new Date(NOW.getTime() - DAY),
    });
    expect(() => validateCertificate({ ...base, certificatePem: expired })).toThrow(/vencido/);
  });

  it("rechaza un certificado que todavía no rige", () => {
    const future = fakeCertificate({ keys, validFrom: new Date(NOW.getTime() + DAY) });
    expect(() => validateCertificate({ ...base, certificatePem: future })).toThrow(/todavía no/);
  });

  it("rechaza un certificado de otro CUIT", () => {
    expect(() => validateCertificate({ ...base, expectedCuit: OTHER_CUIT })).toThrow(/otro CUIT/);
  });

  it("rechaza un certificado que no corresponde a la clave", () => {
    expect(() => validateCertificate({ ...base, privateKeyPem: otherKeys.privateKey })).toThrow(
      /no corresponde a la clave/,
    );
  });

  it("ningún error incluye la clave privada", () => {
    try {
      validateCertificate({ ...base, privateKeyPem: otherKeys.privateKey });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("PRIVATE KEY");
      expect(String(error)).not.toContain(otherKeys.privateKey.split("\n")[1]);
    }
  });
});

describe("daysUntilExpiration", () => {
  it("cuenta días enteros", () => {
    expect(daysUntilExpiration(new Date(NOW.getTime() + 30 * DAY), NOW)).toBe(30);
    expect(daysUntilExpiration(new Date(NOW.getTime() + 30 * DAY - 1000), NOW)).toBe(29);
  });

  it("es negativo si ya venció", () => {
    expect(daysUntilExpiration(new Date(NOW.getTime() - DAY), NOW)).toBe(-1);
  });
});

describe("generateCertificateRequest", () => {
  const generated = generateCertificateRequest({
    cuit: "20-11111111-2",
    organization: "Importadora Ñandú S.R.L.",
    commonName: "El Maestro",
  });

  it("el pedido lleva el CUIT, la razón social y el nombre, y está bien firmado", () => {
    expect(readCertificateRequest(generated.csrPem)).toEqual({
      cuit: CUIT,
      organization: "Importadora Nandu S.R.L.",
      commonName: "El Maestro",
      signatureValid: true,
    });
  });

  it("el pedido no contiene la clave privada", () => {
    expect(generated.csrPem).toContain("CERTIFICATE REQUEST");
    expect(generated.csrPem).not.toContain("PRIVATE KEY");
  });

  it("un certificado emitido para ese pedido corresponde a la clave generada", () => {
    // Lo que hace ARCA: firma un certificado con la clave pública del pedido.
    const publicKeyPem = forge.pki.publicKeyToPem(forge.pki.certificationRequestFromPem(generated.csrPem).publicKey!);
    const issued = fakeCertificate({ keys: { privateKey: keys.privateKey, publicKey: publicKeyPem } });
    expect(certificateMatchesKey(issued, generated.privateKeyPem)).toBe(true);
    expect(certificateMatchesKey(issued, keys.privateKey)).toBe(false);
  });

  it("cada pedido tiene una clave distinta", () => {
    const again = generateCertificateRequest({ cuit: CUIT, organization: "Negocio", commonName: "Sistema" });
    expect(again.privateKeyPem).not.toBe(generated.privateKeyPem);
  });

  it("no genera nada sin CUIT válido o sin razón social", () => {
    expect(() => generateCertificateRequest({ cuit: "20111111113", organization: "Negocio", commonName: "S" })).toThrow(
      /CUIT válido/,
    );
    expect(() => generateCertificateRequest({ cuit: CUIT, organization: "  ", commonName: "S" })).toThrow(
      /razón social/,
    );
  });
});

describe("readCertificateRequest", () => {
  it("rechaza un archivo que no es un pedido", () => {
    expect(() => readCertificateRequest("hola")).toThrow(CertificateError);
    expect(() => readCertificateRequest(validPem)).toThrow(CertificateError);
  });
});
