import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB, igual que el límite del bucket (scripts/setup-storage.ts).

/**
 * Sube una foto de producto a Supabase Storage y devuelve su URL pública.
 * Tira un error con mensaje en español si el archivo no es válido — las
 * Server Actions que la llaman lo capturan y lo devuelven como `error`
 * (specs/004, sección 7: "se avisa con un mensaje claro").
 */
export async function uploadProductPhoto(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato de imagen no soportado. Usá JPG, PNG o WEBP.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("La foto es demasiado pesada (máximo 5 MB).");
  }

  const admin = createAdminClient();
  const ext = file.type.split("/")[1];
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage
    .from("product-photos")
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error("No se pudo subir la foto, probá de nuevo.");

  const { data } = admin.storage.from("product-photos").getPublicUrl(path);
  return data.publicUrl;
}
