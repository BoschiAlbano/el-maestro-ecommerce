import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes de cliente (navegador).
 * Usar solo para Auth (login/logout) — las consultas a datos van por Prisma
 * en el servidor, nunca desde el navegador (ver constitución, regla 14).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
