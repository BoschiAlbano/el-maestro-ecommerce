import "server-only";
import type { Prisma, AuditAction } from "@/generated/prisma/client";

type LogAuditInput = {
  userId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  detail?: Prisma.InputJsonValue;
  reason?: string;
};

/**
 * Registra una entrada de auditoría. Recibe el cliente de la transacción en
 * curso (`tx`), no una conexión nueva — la entrada se guarda siempre junto
 * con la acción que audita, nunca por separado (specs/003, sección 5).
 *
 * Uso: `prisma.$transaction(async (tx) => { await tx.user.create(...); await logAudit(tx, {...}); })`
 */
export async function logAudit(tx: Prisma.TransactionClient, input: LogAuditInput) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      detail: input.detail,
      reason: input.reason,
    },
  });
}
