import "server-only";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Usuario actual (con su rol y matriz de permisos) o `null` si no hay sesión.
 * Separado de `@/lib/permissions` a propósito: esto toca Supabase + Prisma,
 * y `permissions.ts` lo importan también componentes cliente (la
 * navegación) que no pueden arrastrar ese runtime (ver nota en ese archivo).
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return prisma.user.findUnique({
    where: { authUserId: user.id },
    include: { role: { include: { permissions: true } } },
  });
}
