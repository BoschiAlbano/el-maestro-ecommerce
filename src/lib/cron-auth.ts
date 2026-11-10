import { createHash, timingSafeEqual } from "node:crypto";

// Valida el encabezado `Authorization: Bearer <secret>` que Vercel Cron envía
// en cada ejecución (spec 018). Falla cerrada: sin secreto configurado no
// autoriza a nadie (RF-3).

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!authorization) return false;
  // Se comparan los hashes para que ambos buffers tengan el mismo largo
  // (timingSafeEqual lo exige) y no se filtre el largo del secreto.
  return timingSafeEqual(sha256(authorization), sha256(`Bearer ${secret}`));
}
