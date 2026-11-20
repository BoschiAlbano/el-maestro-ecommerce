import { isAuthorizedCron } from "@/lib/cron-auth";
import { runMaintenance } from "@/lib/mercadolibre/recovery";

// Spec 019: Vercel Cron llama a esta ruta una vez por día. Trae los avisos
// perdidos de Mercado Libre, reintenta los fallidos y limpia los viejos.
// Mismo secreto que el keep-alive (spec 018). Nunca se cachea.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const summary = await runMaintenance();
    return Response.json({ ok: true, at: new Date().toISOString(), summary });
  } catch (error) {
    // Sin detalles al exterior; el tipo de error queda en el registro del servidor.
    console.error("[mercadolibre] falló la pasada diaria:", error instanceof Error ? error.name : "error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
