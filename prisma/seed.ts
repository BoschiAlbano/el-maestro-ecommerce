import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Semilla de desarrollo: crea (o reutiliza) un usuario Dueño para poder
// probar login/logout sin pasar por el dashboard de Supabase cada vez.
// No corre sola ni en migraciones ni en el deploy — se invoca a mano con
// `npx prisma db seed`. Ver specs/001-base-del-proyecto/plan.md.
//
// Requiere SUPABASE_SERVICE_ROLE_KEY (API admin de Supabase Auth) además de
// las variables normales de .env. Nunca se sube al repo ni va al cliente.

const email = process.env.SEED_ADMIN_EMAIL ?? "dueno@importadora.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "cambiar-esta-password-123";

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

async function main() {
  const authUserId = await findOrCreateAuthUser();

  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.upsert({
    where: { authUserId },
    update: {},
    create: { authUserId },
  });

  await prisma.$disconnect();

  console.log("Usuario de prueba listo:");
  console.log(`  Email:    ${email}`);
  console.log(`  authUserId: ${authUserId}`);
  console.log(`  users.id:   ${user.id}`);
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
