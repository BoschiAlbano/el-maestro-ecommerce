import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton de PrismaClient. En desarrollo, Next.js recarga módulos en cada
// cambio (HMR); sin este patrón se abriría una conexión nueva por recarga
// hasta agotar el pool del pooler de Supabase.
//
// DATABASE_URL es el pooler de Supabase (transaction mode, puerto 6543).
// La conexión directa (DIRECT_URL) la usa Prisma Migrate, no la app
// (ver prisma7.config.ts y specs/001-base-del-proyecto/plan.md, sección 1).

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
