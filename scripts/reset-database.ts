import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Borra TODOS los datos de negocio (productos, marcas, rubros, stock,
// ingresos, caja, auditoría, usuarios y roles) para arrancar con datos
// reales en vez de los de prueba acumulados durante specs 001-007. Pedido
// explícito del cliente (2026-10-16) — no correr sin esa confirmación.
//
// Corre con: CONFIRM_RESET=yes npx tsx scripts/reset-database.ts
// (el env var es un freno a propósito: no se ejecuta por accidente.)

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function main() {
  if (process.env.CONFIRM_RESET !== "yes") {
    console.error('Freno de seguridad: correr con CONFIRM_RESET=yes para confirmar el borrado.');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const admin = createAdminClient();

  const users = await prisma.user.findMany({ select: { authUserId: true, email: true } });

  console.log(`Borrando datos de ${users.length} usuario(s) y todo lo demás...`);

  await prisma.auditLog.deleteMany();
  await prisma.productPriceHistory.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockEntryItem.deleteMany();
  await prisma.stockEntry.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashShift.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.rubro.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.setting.deleteMany();

  console.log("Tablas de Prisma vaciadas. Borrando usuarios de Supabase Auth...");

  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.authUserId);
    if (error) {
      console.error(`No se pudo borrar el usuario de Auth ${user.email}:`, error.message);
    } else {
      console.log(`Borrado de Auth: ${user.email}`);
    }
  }

  await prisma.$disconnect();
  console.log("Listo. Correr `pnpm db:seed` para recrear el Dueño y los roles de ejemplo.");
}

main().catch((error) => {
  console.error("Error reseteando la base:", error);
  process.exit(1);
});
