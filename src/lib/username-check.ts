import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, usernameKey, validateUsername } from "@/lib/username";

export type UsernameCheck = { error: string } | { username: string; usernameKey: string };

/**
 * Valida el formato y la unicidad (sin distinguir mayúsculas) de un usuario
 * antes de guardarlo (specs/016). `excludeUserId` es la cuenta que se está
 * editando, para que no choque consigo misma.
 */
export async function checkUsername(raw: string, excludeUserId?: string): Promise<UsernameCheck> {
  const formatError = validateUsername(raw);
  if (formatError) return { error: formatError };

  const key = usernameKey(raw);
  const existing = await prisma.user.findUnique({ where: { usernameKey: key }, select: { id: true } });
  if (existing && existing.id !== excludeUserId) return { error: "Ese usuario ya existe." };

  return { username: normalizeUsername(raw), usernameKey: key };
}
