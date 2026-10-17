import "server-only";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { loadTravelList } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.INVENTARIO, "ver");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const url = new URL(request.url);
  const marca = url.searchParams.get("marca");
  const rubro = url.searchParams.get("rubro");
  const items =
    (await loadTravelList(currentUser, {
      brandId: marca && marca !== "__all__" ? marca : undefined,
      rubroId: rubro && rubro !== "__all__" ? rubro : undefined,
    })) ?? [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lista de viaje");
  sheet.addRow(["Producto", "Disponible", "Sugerida"]);
  sheet.getRow(1).font = { bold: true };
  for (const item of items) sheet.addRow([item.name, item.available, item.suggested]);
  sheet.columns.forEach((col) => (col.width = 28));

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lista-de-viaje.xlsx"',
    },
  });
}
