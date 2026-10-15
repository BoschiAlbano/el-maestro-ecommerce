import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave `service_role` (API admin de Auth).
 * Usar SOLO en Server Actions de administración de usuarios (specs/002) —
 * nunca en código que corra en el navegador, nunca se expone al cliente
 * (constitución, regla 16).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
