import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import type { CredentialDeps, CredentialRepo } from "./credential-service";

// El certificado de ARCA sobre la tabla `arca_credentials` (specs/023).

export const prismaCredentialRepo: CredentialRepo = {
  async get(environment) {
    const row = await prisma.arcaCredential.findUnique({ where: { environment } });
    if (!row) return null;
    return {
      certificatePem: row.certificatePem,
      privateKeyEnc: row.privateKeyEnc,
      pendingKeyEnc: row.pendingKeyEnc,
      pendingCsrPem: row.pendingCsrPem,
      cuit: row.cuit,
      expiresAt: row.expiresAt,
      uploadedByUserId: row.uploadedByUserId,
      uploadedAt: row.uploadedAt,
    };
  },

  async apply(change) {
    await prisma.$transaction(async (tx) => {
      if (change.row === null) {
        await tx.arcaCredential.deleteMany({ where: { environment: change.environment } });
      } else {
        await tx.arcaCredential.upsert({
          where: { environment: change.environment },
          create: { environment: change.environment, ...change.row },
          update: change.row,
        });
      }
      // El permiso temporal pertenece al certificado: si el certificado cambia, deja de servir.
      if (change.deleteTickets) {
        await tx.arcaTicket.deleteMany({ where: { environment: change.environment } });
      }
      await logAudit(tx, {
        userId: change.audit.userId,
        action: "ARCA_CERTIFICATE_UPDATED",
        targetType: "ArcaCredential",
        targetId: change.environment,
        detail: change.audit.detail,
      });
    });
  },
};

/** ¿El servidor tiene la clave que cifra el certificado y el permiso? */
export function hasArcaEncryptionKey(): boolean {
  return Boolean(process.env.ARCA_ENCRYPTION_KEY?.trim());
}

/** Las dependencias reales del servicio de certificados. Sin clave de cifrado, cifrar y descifrar fallan cerrado. */
export function credentialDeps(): CredentialDeps {
  const key = process.env.ARCA_ENCRYPTION_KEY?.trim();
  return {
    repo: prismaCredentialRepo,
    encrypt: (plain) => encryptSecret(plain, key),
    decrypt: (stored) => decryptSecret(stored, key),
    now: () => new Date(),
  };
}
