import { isAuthorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

// Spec 018: Vercel Cron llama a esta ruta una vez por día para que Supabase
// (plan gratuito) registre actividad y no pause el proyecto por inactividad.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (error) {
    console.error("[keep-alive] falló la consulta a la base", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
