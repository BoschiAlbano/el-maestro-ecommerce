import "server-only";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserLike } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { computeExpectedCash } from "@/lib/cash-shift";
import { computeCommittedQuantities } from "@/lib/order";
import { computeTravelList, type TravelListItem } from "@/lib/travel-list";
import { toTucumanDateKey, tucumanMidnightUtc, addDaysToDateKey } from "@/lib/analytics";

export type HomeData = {
  caja: {
    open: { openedByName: string; openedAt: Date; expectedCash: number } | null;
    today: { ingresos: number; egresos: number; neto: number };
  } | null;
  pedidosPendientes: number | null;
  stock: { alertCount: number } | null;
};

export type TravelListFilters = { brandId?: string; rubroId?: string };

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
    const openShift = await prisma.cashShift.findFirst({
      where: { closedAt: null },
      include: { openedByUser: true, movements: true },
    });

    const todayKey = toTucumanDateKey(new Date());
    const todayStart = tucumanMidnightUtc(todayKey);
    const todayEnd = tucumanMidnightUtc(addDaysToDateKey(todayKey, 1));
    const todayMovements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    });
    const ingresos = todayMovements
      .filter((m) => m.type === "INGRESO")
      .reduce((sum, m) => sum + m.amount.toNumber(), 0);
    const egresos = todayMovements
      .filter((m) => m.type === "EGRESO")
      .reduce((sum, m) => sum + m.amount.toNumber(), 0);

    caja = {
      open: openShift
        ? {
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
          }
        : null,
      today: { ingresos, egresos, neto: ingresos - egresos },
    };
  }

  let pedidosPendientes: number | null = null;
  if (hasPermission(currentUser, ModuloNegocio.PEDIDOS, "ver")) {
    pedidosPendientes = await prisma.order.count({ where: { status: "PENDIENTE" } });
  }

  const travelList = await loadTravelList(currentUser);
  const stock: HomeData["stock"] = travelList ? { alertCount: travelList.length } : null;

  return { caja, pedidosPendientes, stock };
}
