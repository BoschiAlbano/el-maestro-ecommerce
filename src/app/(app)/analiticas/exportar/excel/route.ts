import "server-only";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { parseAnalyticsFilters } from "@/lib/analytics";
import { loadAnalyticsData, type AnalyticsData } from "@/lib/analytics-data";

export const dynamic = "force-dynamic";

function addGroupSheet(workbook: ExcelJS.Workbook, name: string, groups: AnalyticsData["porEmpleado"]) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(["Nombre", "Total", "Cantidad"]);
  sheet.getRow(1).font = { bold: true };
  for (const g of groups) sheet.addRow([g.label, g.total, g.count]);
  sheet.columns.forEach((col) => (col.width = 24));
}

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

  const workbook = new ExcelJS.Workbook();

  const resumen = workbook.addWorksheet("Resumen");
  resumen.addRow(["Indicador", "Período filtrado", "Período anterior"]);
  resumen.getRow(1).font = { bold: true };
  resumen.addRow(["Total vendido", data.totalVentas, data.periodoAnterior.totalVentas]);
  resumen.addRow(["Cantidad de ventas", data.cantidadVentas, data.periodoAnterior.cantidadVentas]);
  resumen.addRow(["Ticket promedio", data.ticketPromedio, data.periodoAnterior.ticketPromedio]);
  resumen.columns.forEach((col) => (col.width = 24));

  addGroupSheet(workbook, "Ventas por empleado", data.porEmpleado);
  addGroupSheet(workbook, "Ventas por turno", data.porTurno);
  addGroupSheet(workbook, "Ventas por canal", data.porCanal);

  const masVendidos = workbook.addWorksheet("Productos más vendidos");
  masVendidos.addRow(["Producto", "Cantidad", "Total"]);
  masVendidos.getRow(1).font = { bold: true };
  for (const g of data.masVendidos) masVendidos.addRow([g.label, g.cantidad, g.total]);
  masVendidos.columns.forEach((col) => (col.width = 28));

  if (data.sinMovimiento) {
    const sinMovimiento = workbook.addWorksheet("Productos sin movimiento");
    sinMovimiento.addRow(["Producto"]);
    sinMovimiento.getRow(1).font = { bold: true };
    for (const p of data.sinMovimiento) sinMovimiento.addRow([p.name]);
    sinMovimiento.columns.forEach((col) => (col.width = 32));
  }

  if (verCostos && data.margen) {
    const margenSheet = workbook.addWorksheet("Márgenes");
    margenSheet.addRow(["Margen total", "Margen %"]);
    margenSheet.getRow(1).font = { bold: true };
    margenSheet.addRow([data.margen.totalMargin, `${data.margen.marginPct.toFixed(1)}%`]);
    margenSheet.columns.forEach((col) => (col.width = 20));

    for (const [label, groups] of [
      ["Margen por producto", data.margenPorProducto],
      ["Margen por marca", data.margenPorMarca],
      ["Margen por rubro", data.margenPorRubro],
    ] as const) {
      if (!groups) continue;
      const sheet = workbook.addWorksheet(label);
      sheet.addRow(["Nombre", "Margen", "Margen %"]);
      sheet.getRow(1).font = { bold: true };
      for (const g of groups) sheet.addRow([g.label, g.totalMargin, `${g.marginPct.toFixed(1)}%`]);
      sheet.columns.forEach((col) => (col.width = 24));
    }
  }

  if (verCostos && data.valorizacionStock !== null) {
    const valorizacion = workbook.addWorksheet("Valorización de stock");
    valorizacion.addRow(["Valorización total"]);
    valorizacion.getRow(1).font = { bold: true };
    valorizacion.addRow([data.valorizacionStock]);
    valorizacion.columns.forEach((col) => (col.width = 24));
  }

  addGroupSheet(workbook, "Diferencias de caja", data.diferenciasCaja);

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="analiticas.xlsx"',
    },
  });
}
