import "server-only";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { IMPORT_COLUMNS } from "@/lib/product-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = await getCurrentUser();
  try {
    requirePermission(currentUser, ModuloNegocio.CATALOGO, "crear");
  } catch {
    return new Response("No tenés permiso para esto.", { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow(IMPORT_COLUMNS);
  sheet.addRow([
    "Auricular Bluetooth",
    "Genérica",
    "Electrónica",
    "Audio",
    "",
    "1000",
    "1500",
    "5",
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"',
    },
  });
}
