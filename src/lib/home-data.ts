import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserLike } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { computeExpectedCash } from "@/lib/cash-shift";
import { computeCommittedQuantities } from "@/lib/order";
import { computeTravelList, type TravelListItem } from "@/lib/travel-list";
import { topProductsByQuantity, type TopProduct } from "@/lib/home-charts";
import { toTucumanDateKey, tucumanMidnightUtc, addDaysToDateKey } from "@/lib/analytics";

export type HomeData = {
  caja: {
    /** Turno actual: la caja abierta ahora (null si no hay ninguna). */
    open: {
      openedByName: string;
      openedAt: Date;
      expectedCash: number;
      ventas: { total: number; count: number };
      /** Ingresos menos egresos por transferencia del turno. */
      transferencias: number;
    } | null;
    /** Hoy: todos los turnos del día. */
    today: {
      ingresos: number;
      egresos: number;
      neto: number;
      ventas: { total: number; count: number };
      porMedioPago: { method: string; total: number; count: number }[];
      /** Los 5 productos más vendidos hoy, por unidades (specs/012, RF-11). */
      topProductos: TopProduct[];
    };
  } | null;
  pedidos: { count: number; proximos: { id: string; customerName: string; createdAt: Date }[] } | null;
  stock: {
    alertCount: number;
    /** Los productos con mayor cantidad sugerida (specs/012, RF-12). */
    top: { id: string; name: string; available: number; suggested: number }[];
  } | null;
};

export type TravelListFilters = { q?: string; brandId?: string; rubroId?: string };

/**
 * Lista de viaje (specs/012) — única fuente para el inicio (solo el
 * conteo, sin filtro) y para `/lista-de-viaje` (el detalle completo, con
 * filtro opcional de marca/rubro para poder comprar por categoría), para
 * que nunca queden desincronizados (plan 012, sección 2).
 */
export async function loadTravelList(
  currentUser: UserLike,
  filters: TravelListFilters = {},
): Promise<TravelListItem[] | null> {
  if (!hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) return null;

  // El comprometido se calcula siempre sobre TODOS los productos (el
  // filtro es solo para decidir qué mostrar en la lista, no cambia cuánto
  // está realmente comprometido de cada uno).
  const productWhere: Prisma.ProductWhereInput = { active: true };
  if (filters.brandId) productWhere.brandId = filters.brandId;
  if (filters.rubroId) productWhere.rubroId = filters.rubroId;
  if (filters.q) {
    // Mismo criterio que el buscador de /productos y /inventario: nombre o código de barras.
    productWhere.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { barcode: { contains: filters.q } },
    ];
  }

  const [products, pendingOrderItems] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, currentStock: true, minStock: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: "PENDIENTE" } },
      select: { productId: true, quantityOrdered: true, quantityDelivered: true },
    }),
  ]);

  const committed = computeCommittedQuantities(pendingOrderItems);
  return computeTravelList(products, committed);
}

export async function loadHomeData(currentUser: UserLike): Promise<HomeData> {
  let caja: HomeData["caja"] = null;
  if (hasPermission(currentUser, ModuloNegocio.CAJA, "ver")) {
    const todayKey = toTucumanDateKey(new Date());
    const todayStart = tucumanMidnightUtc(todayKey);
    const todayEnd = tucumanMidnightUtc(addDaysToDateKey(todayKey, 1));
    const todayRange = { gte: todayStart, lt: todayEnd };

    const [openShift, todayMovements, todaySales, todayPayments, todayItems] = await Promise.all([
      prisma.cashShift.findFirst({
        where: { closedAt: null },
        include: { openedByUser: true, movements: true },
      }),
      prisma.cashMovement.findMany({ where: { createdAt: todayRange } }),
      prisma.sale.findMany({
        where: { voidedAt: null, createdAt: todayRange },
        select: { createdAt: true, total: true },
      }),
      prisma.cashMovement.groupBy({
        by: ["paymentMethod"],
        where: { type: "INGRESO", sale: { voidedAt: null, createdAt: todayRange } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.saleItem.findMany({
        where: { sale: { voidedAt: null, createdAt: todayRange } },
        select: { productId: true, quantity: true, unitSalePrice: true, product: { select: { name: true } } },
      }),
    ]);

    const ingresos = todayMovements
      .filter((m) => m.type === "INGRESO")
      .reduce((sum, m) => sum + m.amount.toNumber(), 0);
    const egresos = todayMovements
      .filter((m) => m.type === "EGRESO")
      .reduce((sum, m) => sum + m.amount.toNumber(), 0);
    const todaySalesRows = todaySales.map((s) => ({ createdAt: s.createdAt, total: s.total.toNumber() }));

    let open: NonNullable<HomeData["caja"]>["open"] = null;
    if (openShift) {
      const shiftSales = await prisma.sale.aggregate({
        where: { shiftId: openShift.id, voidedAt: null },
        _sum: { total: true },
        _count: true,
      });
      const transferencias = openShift.movements
        .filter((m) => m.paymentMethod === "TRANSFERENCIA")
        .reduce((sum, m) => sum + (m.type === "INGRESO" ? m.amount.toNumber() : -m.amount.toNumber()), 0);
      open = {
        openedByName: openShift.openedByUser.name,
        openedAt: openShift.openedAt,
        expectedCash: computeExpectedCash(
          openShift.openingAmount.toNumber(),
          openShift.movements.map((m) => ({
            type: m.type,
            amount: m.amount.toNumber(),
            paymentMethod: m.paymentMethod,
          })),
        ),
        ventas: { total: shiftSales._sum.total?.toNumber() ?? 0, count: shiftSales._count },
        transferencias,
      };
    }

    caja = {
      open,
      today: {
        ingresos,
        egresos,
        neto: ingresos - egresos,
        ventas: { total: todaySalesRows.reduce((sum, s) => sum + s.total, 0), count: todaySalesRows.length },
        porMedioPago: todayPayments
          .map((r) => ({ method: r.paymentMethod, total: r._sum.amount?.toNumber() ?? 0, count: r._count }))
          .sort((a, b) => b.total - a.total),
        topProductos: topProductsByQuantity(
          todayItems.map((i) => ({
            productId: i.productId,
            productName: i.product.name,
            quantity: i.quantity,
            unitSalePrice: i.unitSalePrice.toNumber(),
          })),
          5,
        ),
      },
    };
  }

  let pedidos: HomeData["pedidos"] = null;
  if (hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    const [count, proximos] = await Promise.all([
      prisma.order.count({ where: { status: "PENDIENTE" } }),
      prisma.order.findMany({
        where: { status: "PENDIENTE" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true, customerName: true, createdAt: true },
      }),
    ]);
    pedidos = { count, proximos };
  }

  const travelList = await loadTravelList(currentUser);
  const stock: HomeData["stock"] = travelList
    ? {
        alertCount: travelList.length,
        top: [...travelList]
          .sort((a, b) => b.suggested - a.suggested)
          .slice(0, 5)
          .map((item) => ({ id: item.id, name: item.name, available: item.available, suggested: item.suggested })),
      }
    : null;

  return { caja, pedidos, stock };
}
