import "server-only";
import type { MlOrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Lo que cargan las pantallas de órdenes (specs/022, plan sección 4).

/** «Por despachar» agrupa para preparar y lista para despachar: es lo que abre la pantalla (RF-13). */
export const ORDER_FILTERS = {
  pendientes: { label: "Por despachar", statuses: ["TO_PREPARE", "READY_TO_SHIP"] },
  encamino: { label: "En camino", statuses: ["SHIPPED"] },
  entregadas: { label: "Entregadas", statuses: ["DELIVERED"] },
  noentregadas: { label: "No entregadas", statuses: ["NOT_DELIVERED"] },
  canceladas: { label: "Canceladas", statuses: ["CANCELLED"] },
  todas: { label: "Todas", statuses: null },
} as const satisfies Record<string, { label: string; statuses: MlOrderStatus[] | null }>;

export type OrderFilterKey = keyof typeof ORDER_FILTERS;

export function parseOrderFilter(value: string | undefined): OrderFilterKey {
  return value && value in ORDER_FILTERS ? (value as OrderFilterKey) : "pendientes";
}

export type OrderRow = {
  id: string;
  number: string;
  createdAt: Date;
  buyerNickname: string;
  items: { title: string; quantity: number }[];
  total: string;
  status: MlOrderStatus;
  dispatchDeadline: Date | null;
  outOfStock: boolean;
  fraudRisk: boolean;
  needsReview: boolean;
};

export async function loadOrders(filter: { key: OrderFilterKey; from?: Date; to?: Date }): Promise<OrderRow[]> {
  const statuses = ORDER_FILTERS[filter.key].statuses;
  const where: Prisma.MercadoLibreOrderWhereInput = {
    ...(statuses ? { status: { in: [...statuses] } } : {}),
    ...(filter.from || filter.to ? { mlCreatedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
  };
  const rows = await prisma.mercadoLibreOrder.findMany({
    where,
    include: { items: { select: { title: true, quantity: true } } },
    // Por despachar: la fecha límite más próxima primero (RF-13). El resto: las más nuevas primero.
    orderBy: filter.key === "pendientes" ? [{ dispatchDeadline: { sort: "asc", nulls: "last" } }] : [{ mlCreatedAt: "desc" }],
    take: 200,
  });
  return rows.map((o) => ({
    id: o.id,
    number: o.mlPackId ?? o.mlOrderIds[0],
    createdAt: o.mlCreatedAt,
    buyerNickname: o.buyerNickname,
    items: o.items,
    total: o.total.toString(),
    status: o.status,
    dispatchDeadline: o.dispatchDeadline,
    outOfStock: o.outOfStock,
    fraudRisk: o.fraudRisk,
    needsReview: o.needsReview !== null,
  }));
}

export async function loadOrderDetail(id: string) {
  return prisma.mercadoLibreOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, name: true, currentStock: true } } } },
      events: { orderBy: { at: "asc" } },
      sale: { select: { id: true, ticketNumber: true, voidedAt: true } },
      labelPrintedByUser: { select: { name: true } },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
