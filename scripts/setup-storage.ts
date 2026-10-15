import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Import relativo, no el alias "@/": los scripts corridos con tsx (fuera de
// Next.js) no resuelven los paths de tsconfig (mismo criterio que
// prisma/seed.ts). Se repite acá la lógica de src/lib/supabase/admin.ts en
// vez de importarlo, porque ese archivo tiene `import "server-only"`
// (specs/003, plan.md) que rompe fuera de un build de Next.
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Crea el bucket de Supabase Storage para fotos de producto (specs/004,
// plan.md sección 3 y 7). No es parte del esquema de Postgres que maneja
// Prisma, así que se crea una sola vez con este script — se deja en el
// repo para que sea reproducible si hace falta recrear el proyecto.
//
// Corre con: npx tsx scripts/setup-storage.ts

const BUCKET = "product-photos";

async function main() {
  const admin = createAdminClient();

  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;

  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`El bucket "${BUCKET}" ya existe, no hago nada.`);
    return;
  }

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: true, // las fotos no son datos sensibles; se sirven por URL pública directa.
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) throw error;

  console.log(`Bucket "${BUCKET}" creado.`);
}

main().catch((error) => {
  console.error("Error creando el bucket:", error);
  process.exit(1);
});
