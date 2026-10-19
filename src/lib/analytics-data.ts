import "server-only";
import { prisma } from "@/lib/prisma";
import { hasSpecialPermission, type UserLike } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import {
  toTucumanDateKey,
  computePreviousPeriod,
  computeTicketPromedio,
  computeMarginSummary,
  computeStockValuation,
  groupBy,
  type ParsedAnalyticsFilters,
} from "./analytics";

/** Sentinel para "ventas sin pedido vinculado" al filtrar/agrupar por canal (specs/011, sección 2). */
export const MOSTRADOR = "Mostrador";

export type AnalyticsFilters = ParsedAnalyticsFilters;

type GroupTotal = { key: string; label: string; total: number; count: number };
type MarginGroup = { key: string; label: string; totalMargin: number; marginPct: number };

export type AnalyticsData = {
  totalVentas: number;
  cantidadVentas: number;
  ticketPromedio: number;
  unidadesVendidas: number;
  periodoAnterior: { totalVentas: number; cantidadVentas: number; ticketPromedio: number; unidadesVendidas: number };
  /** Ventas anuladas dentro del rango (por fecha de anulación). */
  ventasAnuladas: { cantidad: number; total: number };
  /** La venta de mayor importe del rango (null si no hubo ventas). */
  ventaMasGrande: { total: number; employeeName: string; createdAt: Date } | null;
  /** Costo de la mercadería vendida — solo con el permiso de costos. */
  costoVendido: number | null;
  evolucionDiaria: { day: string; total: number }[];
  porEmpleado: GroupTotal[];
  porTurno: GroupTotal[];
  porCanal: GroupTotal[];
  masVendidos: (GroupTotal & { cantidad: number })[];
  sinMovimiento: { id: string; name: string }[] | null;
  margen: { totalMargin: number; marginPct: number } | null;
  margenPorProducto: MarginGroup[] | null;
  margenPorMarca: MarginGroup[] | null;
  margenPorRubro: MarginGroup[] | null;
  valorizacionStock: number | null;
  diferenciasCaja: GroupTotal[];
  /** Lo cobrado en el período por medio de pago (ingresos de caja de ventas no anuladas). */
  porMedioPago: { method: string; total: number; count: number }[];
};

type SaleItemRow = {
  saleId: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftLabel: string;
  channel: string;
  productId: string;
  productName: string;
  brandId: string | null;
  brandName: string;
  rubroId: string;
  rubroName: string;
  quantity: number;
  unitSalePrice: number;
  unitCost: number;
  createdAt: Date;
};

function buildSaleItemWhere(filters: AnalyticsFilters, from: Date, to: Date): Prisma.SaleItemWhereInput {
  const saleWhere: Prisma.SaleWhereInput = {
    voidedAt: null,
    createdAt: { gte: from, lt: to },
  };
  if (filters.employeeId) saleWhere.userId = filters.employeeId;
  if (filters.channel === MOSTRADOR) saleWhere.orderId = null;
  else if (filters.channel) saleWhere.order = { channel: filters.channel };
  if (filters.paymentMethod) {
    saleWhere.cashMovements = { some: { paymentMethod: filters.paymentMethod, type: "INGRESO" } };
  }

  const productWhere: Prisma.ProductWhereInput = {};
  if (filters.brandId) productWhere.brandId = filters.brandId;
  if (filters.rubroId) productWhere.rubroId = filters.rubroId;

  return {
    sale: saleWhere,
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(Object.keys(productWhere).length > 0 ? { product: productWhere } : {}),
  };
}

async function fetchSaleItemRows(filters: AnalyticsFilters, from: Date, to: Date): Promise<SaleItemRow[]> {
  const items = await prisma.saleItem.findMany({
    where: buildSaleItemWhere(filters, from, to),
    include: {
      sale: { include: { user: true, order: true, shift: true } },
      product: { include: { brand: true, rubro: true } },
    },
  });

  return items.map((item) => ({
    saleId: item.saleId,
    employeeId: item.sale.userId,
    employeeName: item.sale.user.name,
    shiftId: item.sale.shiftId,
    shiftLabel: `Turno del ${new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Tucuman",
    }).format(item.sale.shift.openedAt)}`,
    channel: item.sale.order?.channel ?? MOSTRADOR,
    productId: item.productId,
    productName: item.product.name,
    brandId: item.product.brandId,
    brandName: item.product.brand?.name ?? "Sin marca",
    rubroId: item.product.rubroId,
    rubroName: item.product.rubro.name,
    quantity: item.quantity,
    unitSalePrice: item.unitSalePrice.toNumber(),
    unitCost: item.unitCost.toNumber(),
    createdAt: item.sale.createdAt,
  }));
}

function summarize(rows: SaleItemRow[]): { total: number; count: number } {
  const total = rows.reduce((sum, r) => sum + r.quantity * r.unitSalePrice, 0);
  const count = new Set(rows.map((r) => r.saleId)).size;
  return { total, count };
}

function groupTotals(rows: SaleItemRow[], keyFn: (row: SaleItemRow) => string, labelFn: (row: SaleItemRow) => string): GroupTotal[] {
  const groups = groupBy(rows, keyFn);
  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const { total, count } = summarize(groupRows);
      return { key, label: labelFn(groupRows[0]), total, count };
    })
    .sort((a, b) => b.total - a.total);
}

function groupMargins(
  rows: SaleItemRow[],
  keyFn: (row: SaleItemRow) => string,
  labelFn: (row: SaleItemRow) => string,
): MarginGroup[] {
  const groups = groupBy(rows, keyFn);
  return [...groups.entries()]
    .map(([key, groupRows]) => ({ key, label: labelFn(groupRows[0]), ...computeMarginSummary(groupRows) }))
    .sort((a, b) => b.totalMargin - a.totalMargin);
}

export async function loadAnalyticsData(filters: AnalyticsFilters, currentUser: UserLike): Promise<AnalyticsData> {
  const puedeVerCostos = hasSpecialPermission(currentUser, "verCostosMargenes");

  const rows = await fetchSaleItemRows(filters, filters.from, filters.to);
  const { total: totalVentas, count: cantidadVentas } = summarize(rows);

  const prevPeriod = computePreviousPeriod(filters.from, filters.to);
  const prevRows = await fetchSaleItemRows(filters, prevPeriod.from, prevPeriod.to);
  const prevSummary = summarize(prevRows);
  const unidadesVendidas = rows.reduce((sum, r) => sum + r.quantity, 0);
  const prevUnidadesVendidas = prevRows.reduce((sum, r) => sum + r.quantity, 0);

  const voidedAgg = await prisma.sale.aggregate({
    where: {
      voidedAt: { gte: filters.from, lt: filters.to },
      ...(filters.employeeId ? { userId: filters.employeeId } : {}),
      ...(filters.paymentMethod
        ? { cashMovements: { some: { paymentMethod: filters.paymentMethod, type: "INGRESO" as const } } }
        : {}),
    },
    _sum: { total: true },
    _count: true,
  });
  const ventasAnuladas = { cantidad: voidedAgg._count, total: voidedAgg._sum.total?.toNumber() ?? 0 };

  let ventaMasGrande: AnalyticsData["ventaMasGrande"] = null;
  for (const saleRows of groupBy(rows, (r) => r.saleId).values()) {
    const { total } = summarize(saleRows);
    if (!ventaMasGrande || total > ventaMasGrande.total) {
      ventaMasGrande = { total, employeeName: saleRows[0].employeeName, createdAt: saleRows[0].createdAt };
    }
  }

  const dayGroups = groupBy(rows, (r) => toTucumanDateKey(r.createdAt));
  const evolucionDiaria = [...dayGroups.entries()]
    .map(([day, groupRows]) => ({ day, total: summarize(groupRows).total }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const porEmpleado = groupTotals(rows, (r) => r.employeeId, (r) => r.employeeName);
  const porTurno = groupTotals(rows, (r) => r.shiftId, (r) => r.shiftLabel);
  const porCanal = groupTotals(rows, (r) => r.channel, (r) => r.channel);

  const productGroups = groupBy(rows, (r) => r.productId);
  const masVendidos = [...productGroups.entries()]
    .map(([key, groupRows]) => {
      const { total, count } = summarize(groupRows);
      const cantidad = groupRows.reduce((sum, r) => sum + r.quantity, 0);
      return { key, label: groupRows[0].productName, total, count, cantidad };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 20);

  let sinMovimiento: { id: string; name: string }[] | null = null;
  if (!filters.productId) {
    const productWhere: Prisma.ProductWhereInput = { active: true };
    if (filters.brandId) productWhere.brandId = filters.brandId;
    if (filters.rubroId) productWhere.rubroId = filters.rubroId;
    const allProducts = await prisma.product.findMany({ where: productWhere, select: { id: true, name: true } });
    const soldIds = new Set(rows.map((r) => r.productId));
    sinMovimiento = allProducts.filter((p) => !soldIds.has(p.id));
  }

  let costoVendido: number | null = null;
  let margen: { totalMargin: number; marginPct: number } | null = null;
  let margenPorProducto: MarginGroup[] | null = null;
  let margenPorMarca: MarginGroup[] | null = null;
  let margenPorRubro: MarginGroup[] | null = null;
  let valorizacionStock: number | null = null;
  if (puedeVerCostos) {
    margen = computeMarginSummary(rows);
    costoVendido = rows.reduce((sum, r) => sum + r.quantity * r.unitCost, 0);
    margenPorProducto = groupMargins(rows, (r) => r.productId, (r) => r.productName);
    margenPorMarca = groupMargins(rows, (r) => r.brandId ?? "__sin_marca__", (r) => r.brandName);
    margenPorRubro = groupMargins(rows, (r) => r.rubroId, (r) => r.rubroName);
    const productWhere: Prisma.ProductWhereInput = { active: true };
    if (filters.brandId) productWhere.brandId = filters.brandId;
    if (filters.rubroId) productWhere.rubroId = filters.rubroId;
    const stockProducts = await prisma.product.findMany({
      where: productWhere,
      select: { currentStock: true, purchasePrice: true },
    });
    valorizacionStock = computeStockValuation(
      stockProducts.map((p) => ({ currentStock: p.currentStock, purchasePrice: p.purchasePrice.toNumber() })),
    );
  }

  const shiftWhere: Prisma.CashShiftWhereInput = { closedAt: { gte: filters.from, lt: filters.to } };
  if (filters.employeeId) shiftWhere.closedByUserId = filters.employeeId;
  const closedShifts = await prisma.cashShift.findMany({
    where: shiftWhere,
    include: { closedByUser: true },
  });
  const shiftsByEmployee = groupBy(
    closedShifts.filter((s) => s.closedByUserId),
    (s) => s.closedByUserId!,
  );
  const diferenciasCaja: GroupTotal[] = [...shiftsByEmployee.entries()]
    .map(([key, shifts]) => ({
      key,
      label: shifts[0].closedByUser!.name,
      total: shifts.reduce((sum, s) => sum + (s.difference?.toNumber() ?? 0), 0),
      count: shifts.length,
    }))
    .sort((a, b) => b.total - a.total);

  const paymentRows = await prisma.cashMovement.groupBy({
    by: ["paymentMethod"],
    where: {
      type: "INGRESO",
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      sale: {
        voidedAt: null,
        createdAt: { gte: filters.from, lt: filters.to },
        ...(filters.employeeId ? { userId: filters.employeeId } : {}),
      },
    },
    _sum: { amount: true },
    _count: true,
  });
  const porMedioPago = paymentRows
    .map((r) => ({ method: r.paymentMethod, total: r._sum.amount?.toNumber() ?? 0, count: r._count }))
    .sort((a, b) => b.total - a.total);

  return {
    totalVentas,
    cantidadVentas,
    ticketPromedio: computeTicketPromedio(totalVentas, cantidadVentas),
    unidadesVendidas,
    ventasAnuladas,
    ventaMasGrande,
    costoVendido,
    periodoAnterior: {
      unidadesVendidas: prevUnidadesVendidas,
      totalVentas: prevSummary.total,
      cantidadVentas: prevSummary.count,
      ticketPromedio: computeTicketPromedio(prevSummary.total, prevSummary.count),
    },
    evolucionDiaria,
    porEmpleado,
    porTurno,
    porCanal,
    masVendidos,
    sinMovimiento,
    margen,
    margenPorProducto,
    margenPorMarca,
    margenPorRubro,
    valorizacionStock,
    diferenciasCaja,
    porMedioPago,
  };
}
