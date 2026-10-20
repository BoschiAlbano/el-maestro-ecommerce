import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, ModuloNegocio } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeUsername, usernameKey } from "../src/lib/username";

// Semilla de desarrollo: crea (o reutiliza) el rol Dueño, dos roles de
// ejemplo (Encargado y Cajero — specs/002, sección 10) y un usuario Dueño
// de prueba, para poder probar login/logout y permisos sin pasar por el
// dashboard de Supabase cada vez.
// No corre sola ni en migraciones ni en el deploy — se invoca a mano con
// `pnpm db:seed`. Ver specs/001-base-del-proyecto/plan.md y
// specs/002-usuarios-roles-permisos/plan.md.
//
// Requiere SUPABASE_SERVICE_ROLE_KEY (API admin de Supabase Auth) además de
// las variables normales de .env. Nunca se sube al repo ni va al cliente.

const email = process.env.SEED_ADMIN_EMAIL ?? "dueno@importadora.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "cambiar-esta-password-123";
const name = process.env.SEED_ADMIN_NAME ?? "Dueño de prueba";
const username = normalizeUsername(process.env.SEED_ADMIN_USERNAME ?? name);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (revisá .env).`);
  }
  return value;
}

async function findOrCreateAuthUser(): Promise<string> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Supabase no tiene "buscar por email" directo en la API admin estable;
  // se pagina listUsers() y se busca a mano. Para un puñado de usuarios de
  // desarrollo esto es más que suficiente.
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;

    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) return existing.id;

    if (data.users.length < 200) break;
    page += 1;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin esto, Supabase manda mail de confirmación y no se puede loguear.
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase no devolvió el usuario creado.");

  return data.user.id;
}

/** Todo `true`/`true` en cada módulo: el rol Dueño siempre tiene acceso total. */
async function seedOwnerRole(prisma: PrismaClient) {
  const role = await prisma.role.upsert({
    where: { name: "Dueño" },
    update: {
      isOwnerRole: true,
      verCostosMargenes: true,
      anularVentas: true,
      ajustarStock: true,
      reimprimirTickets: true,
      cerrarCaja: true,
      cambiarPrecios: true,
    },
    create: {
      name: "Dueño",
      isOwnerRole: true,
      verCostosMargenes: true,
      anularVentas: true,
      ajustarStock: true,
      reimprimirTickets: true,
      cerrarCaja: true,
      cambiarPrecios: true,
    },
  });

  for (const mod of Object.values(ModuloNegocio)) {
    await prisma.rolePermission.upsert({
      where: { roleId_module: { roleId: role.id, module: mod } },
      update: { ver: true, crear: true, editar: true, anular: true, exportar: true },
      create: {
        roleId: role.id,
        module: mod,
        ver: true,
        crear: true,
        editar: true,
        anular: true,
        exportar: true,
      },
    });
  }

  return role;
}

/**
 * Roles de ejemplo (specs/002, sección 10). Son punto de partida, no una
 * decisión cerrada — el dueño los ajusta desde la interfaz cuando quiera.
 */
async function seedExampleRoles(prisma: PrismaClient) {
  const operativos: ModuloNegocio[] = [
    ModuloNegocio.CATALOGO,
    ModuloNegocio.INVENTARIO,
    ModuloNegocio.INGRESO_MERCADERIA,
    ModuloNegocio.CAJA,
    ModuloNegocio.VENTAS,
    ModuloNegocio.PEDIDOS,
    ModuloNegocio.EMPLEADOS,
    ModuloNegocio.ANALITICAS,
  ];

  const encargado = await prisma.role.upsert({
    where: { name: "Encargado" },
    update: {},
    create: {
      name: "Encargado",
      verCostosMargenes: false,
      anularVentas: true,
      ajustarStock: true,
      reimprimirTickets: true,
      cerrarCaja: true,
      cambiarPrecios: true,
    },
  });
  for (const mod of operativos) {
    await prisma.rolePermission.upsert({
      where: { roleId_module: { roleId: encargado.id, module: mod } },
      update: {},
      create: {
        roleId: encargado.id,
        module: mod,
        ver: true,
        crear: true,
        editar: true,
        anular: true,
        exportar: true,
      },
    });
  }

  const cajero = await prisma.role.upsert({
    where: { name: "Cajero" },
    update: {},
    create: {
      name: "Cajero",
      verCostosMargenes: false,
      anularVentas: false,
      ajustarStock: false,
      reimprimirTickets: true,
      cerrarCaja: true,
      cambiarPrecios: false,
    },
  });
  for (const mod of [ModuloNegocio.VENTAS, ModuloNegocio.CAJA, ModuloNegocio.PEDIDOS]) {
    await prisma.rolePermission.upsert({
      where: { roleId_module: { roleId: cajero.id, module: mod } },
      update: {},
      create: { roleId: cajero.id, module: mod, ver: true, crear: true, editar: false, anular: false, exportar: false },
    });
  }
}

async function main() {
  const authUserId = await findOrCreateAuthUser();

  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter });

  const ownerRole = await seedOwnerRole(prisma);
  await seedExampleRoles(prisma);

  const user = await prisma.user.upsert({
    where: { authUserId },
    // El usuario solo se fija al crear: si el dueño lo cambió desde /usuarios, el seed no lo pisa.
    update: { name, email, roleId: ownerRole.id },
    create: { authUserId, name, email, username, usernameKey: usernameKey(username), roleId: ownerRole.id },
  });

  await prisma.$disconnect();

  console.log("Usuario de prueba listo:");
  console.log(`  Usuario:    ${username}`);
  console.log(`  Email:      ${email}`);
  console.log(`  Rol:        Dueño`);
  console.log(`  authUserId: ${authUserId}`);
  console.log(`  users.id:   ${user.id}`);
  console.log("Roles de ejemplo: Dueño, Encargado, Cajero.");
  console.log(
    password === "cambiar-esta-password-123"
      ? "  (usando la password por defecto del seed — definí SEED_ADMIN_PASSWORD en .env para una propia)"
      : "  Password: la que pusiste en SEED_ADMIN_PASSWORD",
  );
}

main().catch((error) => {
  console.error("Error corriendo el seed:", error);
  process.exit(1);
});
