import { generateKeyPairSync, randomBytes } from "node:crypto";
import forge from "node-forge";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import {
  CredentialError,
  assertCertificateText,
  assertPrivateKeyText,
  canUseRealEnvironment,
  generateRequest,
  getStatus,
  installFromPending,
  installWithKey,
  loadForUse,
  removeCertificate,
  type CredentialChange,
  type CredentialDeps,
  type CredentialRepo,
  type CredentialRow,
  type FiscalEnvironment,
} from "./credential-service";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");
const CUIT = "20111111112";
const NOW = new Date("2026-11-11T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function newKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}
const caKeys = newKeys();

/** Lo que haría ARCA: emitir un certificado con la clave pública de un pedido. */
function issue(publicKeyPem: string, options: { cuit?: string; validTo?: Date } = {}): string {
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(NOW.getTime() - DAY);
  certificate.validity.notAfter = options.validTo ?? new Date(NOW.getTime() + 700 * DAY);
  certificate.setSubject([
    { name: "commonName", value: "elmaestro" },
    { name: "serialNumber", value: `CUIT ${options.cuit ?? CUIT}` },
  ]);
  certificate.setIssuer([{ name: "commonName", value: "Autoridad de Prueba" }]);
  certificate.sign(forge.pki.privateKeyFromPem(caKeys.privateKey), forge.md.sha256.create());
  return forge.pki.certificateToPem(certificate);
}

const csrPublicKey = (csrPem: string) => forge.pki.publicKeyToPem(forge.pki.certificationRequestFromPem(csrPem).publicKey!);

class MemoryRepo implements CredentialRepo {
  rows = new Map<FiscalEnvironment, CredentialRow>();
  changes: CredentialChange[] = [];
  async get(environment: FiscalEnvironment) {
    return this.rows.get(environment) ?? null;
  }
  async apply(change: CredentialChange) {
    this.changes.push(change);
    if (change.row === null) this.rows.delete(change.environment);
    else this.rows.set(change.environment, change.row);
  }
}

function setup(options: { key?: string } = {}) {
  const repo = new MemoryRepo();
  const key = options.key ?? KEY;
  const deps: CredentialDeps = {
    repo,
    encrypt: (plain) => encryptSecret(plain, key),
    decrypt: (stored) => decryptSecret(stored, key),
    now: () => NOW,
  };
  return { repo, deps };
}

const ME = "usuario-1";
const base = { environment: "HOMOLOGACION" as const, expectedCuit: CUIT, userId: ME };

describe("generateRequest", () => {
  it("guarda la clave cifrada como pendiente y devuelve el pedido", async () => {
    const { repo, deps } = setup();
    const { csrPem, replacedPending } = await generateRequest(deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "Negocio", userId: ME });

    expect(csrPem).toContain("BEGIN CERTIFICATE REQUEST");
    expect(replacedPending).toBe(false);
    const row = repo.rows.get("HOMOLOGACION")!;
    expect(row.pendingKeyEnc).toMatch(/^v1\./);
    expect(row.pendingCsrPem).toBe(csrPem);
    // Ni el pedido ni la fila contienen la clave en claro.
    expect(JSON.stringify(row)).not.toContain("PRIVATE KEY");
    expect(csrPem).not.toContain("PRIVATE KEY");
  });

  it("no toca el certificado que está en uso", async () => {
    const { repo, deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    const before = { ...repo.rows.get("HOMOLOGACION")! };

    await generateRequest(deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "Negocio", userId: ME });
    const after = repo.rows.get("HOMOLOGACION")!;
    expect(after.certificatePem).toBe(before.certificatePem);
    expect(after.privateKeyEnc).toBe(before.privateKeyEnc);
    expect(repo.changes.at(-1)!.deleteTickets).toBe(false);
  });

  it("un pedido nuevo reemplaza al pendiente y lo avisa", async () => {
    const { repo, deps } = setup();
    const input = { environment: "HOMOLOGACION" as const, cuit: CUIT, razonSocial: "Negocio", userId: ME };
    const first = await generateRequest(deps, input);
    const second = await generateRequest(deps, input);
    expect(second.replacedPending).toBe(true);
    expect(second.csrPem).not.toBe(first.csrPem);
    expect(repo.rows.get("HOMOLOGACION")!.pendingCsrPem).toBe(second.csrPem);
  });

  it("sin CUIT válido o sin razón social, no genera nada", async () => {
    const { repo, deps } = setup();
    await expect(generateRequest(deps, { environment: "HOMOLOGACION", cuit: "123", razonSocial: "N", userId: ME })).rejects.toThrow(/CUIT válido/);
    await expect(generateRequest(deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "  ", userId: ME })).rejects.toBeInstanceOf(CredentialError);
    expect(repo.changes).toHaveLength(0);
  });
});

describe("installFromPending", () => {
  async function withPending() {
    const ctx = setup();
    const { csrPem } = await generateRequest(ctx.deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "Negocio", userId: ME });
    return { ...ctx, csrPem, issued: issue(csrPublicKey(csrPem)) };
  }

  it("instala el certificado que ARCA devolvió para el pedido", async () => {
    const { repo, deps, issued } = await withPending();
    const result = await installFromPending(deps, { ...base, certificatePem: issued });

    expect(result.cuit).toBe(CUIT);
    const row = repo.rows.get("HOMOLOGACION")!;
    expect(row.certificatePem).toBe(issued);
    expect(row.pendingKeyEnc).toBeNull();
    expect(row.pendingCsrPem).toBeNull();
    expect(row.cuit).toBe(CUIT);
    expect(row.uploadedByUserId).toBe(ME);
    expect(row.expiresAt!.getTime()).toBeGreaterThan(NOW.getTime());
    // La clave pasó de pendiente a definitiva, cifrada.
    expect(decryptSecret(row.privateKeyEnc!, KEY)).toContain("PRIVATE KEY");
  });

  it("borra el permiso guardado y deja la auditoría en el mismo cambio", async () => {
    const { repo, deps, issued } = await withPending();
    await installFromPending(deps, { ...base, certificatePem: issued });
    const change = repo.changes.at(-1)!;
    expect(change.deleteTickets).toBe(true);
    expect(change.audit.userId).toBe(ME);
    expect(change.audit.detail).toMatchObject({ accion: "certificado cargado", cuit: CUIT });
    // La auditoría tampoco lleva claves.
    expect(JSON.stringify(change.audit)).not.toContain("PRIVATE KEY");
  });

  it("sin un pedido pendiente, explica qué hacer", async () => {
    const { deps } = setup();
    await expect(installFromPending(deps, { ...base, certificatePem: "-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----" })).rejects.toThrow(
      /Primero generá el pedido/,
    );
  });

  it("un certificado de otro CUIT se rechaza y no cambia nada", async () => {
    const { repo, deps, csrPem } = await withPending();
    const before = structuredClone(repo.rows.get("HOMOLOGACION")!);
    const wrong = issue(csrPublicKey(csrPem), { cuit: "30500010912" });
    await expect(installFromPending(deps, { ...base, certificatePem: wrong })).rejects.toThrow(/otro CUIT/);
    expect(repo.rows.get("HOMOLOGACION")).toEqual(before);
  });

  it("un certificado que no corresponde al pedido se rechaza", async () => {
    const { repo, deps } = await withPending();
    const strangerKeys = newKeys();
    const stranger = issue(strangerKeys.publicKey);
    const changesBefore = repo.changes.length;
    await expect(installFromPending(deps, { ...base, certificatePem: stranger })).rejects.toThrow(/no corresponde a la clave/);
    expect(repo.changes).toHaveLength(changesBefore);
  });

  it("un certificado vencido se rechaza", async () => {
    const { deps, csrPem } = await withPending();
    const expired = issue(csrPublicKey(csrPem), { validTo: new Date(NOW.getTime() - 1000) });
    await expect(installFromPending(deps, { ...base, certificatePem: expired })).rejects.toThrow(/vencido/);
  });

  it("si cambió la clave de cifrado, lo dice en lugar de fallar con un error técnico", async () => {
    const { repo, issued } = await withPending();
    const otherDeps: CredentialDeps = { repo, encrypt: (p) => encryptSecret(p, OTHER_KEY), decrypt: (s) => decryptSecret(s, OTHER_KEY), now: () => NOW };
    await expect(installFromPending(otherDeps, { ...base, certificatePem: issued })).rejects.toThrow(/clave de cifrado del servidor/);
  });
});

describe("installWithKey", () => {
  it("instala un par que ya existía", async () => {
    const { repo, deps } = setup();
    const keys = newKeys();
    const result = await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    expect(result.cuit).toBe(CUIT);
    expect(repo.rows.get("HOMOLOGACION")!.privateKeyEnc).toMatch(/^v1\./);
    expect(repo.changes.at(-1)!.deleteTickets).toBe(true);
  });

  it("rechaza una clave que no corresponde al certificado", async () => {
    const { repo, deps } = setup();
    const keys = newKeys();
    await expect(
      installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: newKeys().privateKey }),
    ).rejects.toThrow(/no corresponde a la clave/);
    expect(repo.changes).toHaveLength(0);
  });

  it("conserva un pedido pendiente de otro trámite", async () => {
    const { repo, deps } = setup();
    const { csrPem } = await generateRequest(deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "Negocio", userId: ME });
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    expect(repo.rows.get("HOMOLOGACION")!.pendingCsrPem).toBe(csrPem);
  });

  it("los dos ambientes son independientes", async () => {
    const { repo, deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    expect(repo.rows.has("PRODUCCION")).toBe(false);
  });
});

describe("removeCertificate", () => {
  it("borra el certificado, el pedido pendiente y el permiso guardado", async () => {
    const { repo, deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    await removeCertificate(deps, { environment: "HOMOLOGACION", userId: ME });
    expect(repo.rows.has("HOMOLOGACION")).toBe(false);
    expect(repo.changes.at(-1)).toMatchObject({ row: null, deleteTickets: true });
  });

  it("sin nada cargado, lo explica", async () => {
    const { deps } = setup();
    await expect(removeCertificate(deps, { environment: "HOMOLOGACION", userId: ME })).rejects.toThrow(/No hay ningún certificado/);
  });
});

describe("getStatus: lo que ve la pantalla", () => {
  it("no incluye la clave privada, ni cifrada", async () => {
    const { deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    await generateRequest(deps, { environment: "HOMOLOGACION", cuit: CUIT, razonSocial: "Negocio", userId: ME });
    const status = await getStatus(deps, "HOMOLOGACION");

    expect(Object.keys(status).sort()).toEqual(
      ["cuit", "daysLeft", "expiresAt", "hasCertificate", "hasPendingRequest", "pendingCsrPem", "uploadedAt", "uploadedByUserId"].sort(),
    );
    expect(JSON.stringify(status)).not.toMatch(/PRIVATE KEY|v1\./);
    expect(status).toMatchObject({ hasCertificate: true, cuit: CUIT, hasPendingRequest: true });
  });

  it("cuenta los días que faltan", async () => {
    const { deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey, { validTo: new Date(NOW.getTime() + 30 * DAY + 1000) }), privateKeyPem: keys.privateKey });
    expect((await getStatus(deps, "HOMOLOGACION")).daysLeft).toBe(30);
  });

  it("sin nada cargado", async () => {
    const { deps } = setup();
    expect(await getStatus(deps, "PRODUCCION")).toMatchObject({ hasCertificate: false, cuit: null, hasPendingRequest: false, daysLeft: null });
  });
});

describe("loadForUse", () => {
  it("entrega el certificado y la clave, para el servidor", async () => {
    const { deps } = setup();
    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    const loaded = await loadForUse(deps, "HOMOLOGACION");
    expect(loaded.privateKeyPem).toBe(keys.privateKey);
    expect(loaded.cuit).toBe(CUIT);
  });

  it("sin certificado, vencido o con otra clave de cifrado, explica qué pasó", async () => {
    const { repo, deps } = setup();
    await expect(loadForUse(deps, "HOMOLOGACION")).rejects.toThrow(/Falta cargar el certificado/);

    const keys = newKeys();
    await installWithKey(deps, { ...base, certificatePem: issue(keys.publicKey), privateKeyPem: keys.privateKey });
    const later: CredentialDeps = { ...deps, now: () => new Date(NOW.getTime() + 800 * DAY) };
    await expect(loadForUse(later, "HOMOLOGACION")).rejects.toThrow(/vencido/);

    const wrongKey: CredentialDeps = { repo, encrypt: (p) => encryptSecret(p, OTHER_KEY), decrypt: (s) => decryptSecret(s, OTHER_KEY), now: () => NOW };
    await expect(loadForUse(wrongKey, "HOMOLOGACION")).rejects.toThrow(/clave de cifrado del servidor/);
  });
});

describe("archivos subidos", () => {
  it("acepta el texto de un certificado y de una clave", () => {
    expect(assertCertificateText("-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\r\n")).toContain("BEGIN CERTIFICATE");
    expect(assertPrivateKeyText("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toContain("PRIVATE KEY");
    expect(assertPrivateKeyText("-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----")).toContain("PRIVATE KEY");
  });

  it("rechaza lo que no tiene la forma esperada o es demasiado grande", () => {
    expect(() => assertCertificateText("hola")).toThrow(CredentialError);
    expect(() => assertCertificateText("-----BEGIN PRIVATE KEY-----\nx")).toThrow(/formato/);
    expect(() => assertPrivateKeyText("-----BEGIN CERTIFICATE-----\nx")).toThrow(/formato/);
    expect(() => assertCertificateText("-----BEGIN CERTIFICATE-----\n" + "a".repeat(30_000))).toThrow(/demasiado grande/);
  });
});

describe("canUseRealEnvironment", () => {
  it("solo en el sitio publicado de producción", () => {
    expect(canUseRealEnvironment("production")).toBe(true);
    expect(canUseRealEnvironment("preview")).toBe(false);
    expect(canUseRealEnvironment("development")).toBe(false);
    expect(canUseRealEnvironment(undefined)).toBe(false);
  });
});
