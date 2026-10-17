import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { parseAnalyticsFilters } from "@/lib/analytics";
import { loadAnalyticsData } from "@/lib/analytics-data";
import { AnalyticsPdfDocument } from "./document";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.ANALITICAS, "exportar");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseAnalyticsFilters(Object.fromEntries(url.searchParams), new Date());
  const data = await loadAnalyticsData(filters, currentUser);
  const verCostos = hasSpecialPermission(currentUser, "verCostosMargenes");

  const formatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Tucuman" });
  const hastaInclusive = new Date(filters.to.getTime() - 24 * 60 * 60 * 1000);

  const buffer = await renderToBuffer(
    AnalyticsPdfDocument({
      data,
      verCostos,
      desde: formatter.format(filters.from),
      hasta: formatter.format(hastaInclusive),
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="analiticas-resumen.pdf"',
    },
  });
}
