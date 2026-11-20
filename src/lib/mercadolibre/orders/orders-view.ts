import "server-only";
import type { MlOrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { EXTERNAL_INVOICE_NOTE, orderInvoiceState, type OrderInvoiceState } from "./invoice-state";

// Lo que cargan las pantallas de órdenes (specs/022, plan sección 4; specs/024,
// plan sección 3.6).

/** «Por despachar» agrupa para preparar y lista para despachar: es lo que abre la pantalla (RF-13). */
export const ORDER_FILTERS = {
  pendientes: { label: "Por despachar", statuses: ["TO_PREPARE", "READY_TO_SHIP"] },
  encamino: { label: "En camino", statuses: ["SHIPPED"] },
  entregadas: { label: "Entregadas", statuses: ["DELIVERED"] },
  despachadas: { label: "Despachadas (en camino o entregadas)", statuses: ["SHIPPED", "DELIVERED"] },
  noentregadas: { label: "No entregadas", statuses: ["NOT_DELIVERED"] },
  canceladas: { label: "Canceladas", statuses: ["CANCELLED"] },
  todas: { label: "Todas", statuses: null },
} as const satisfies Record<string, { label: string; statuses: MlOrderStatus[] | null }>;

export type OrderFilterKey = keyof typeof ORDER_FILTERS;

export function parseOrderFilter(value: string | undefined): OrderFilterKey {
  return value && value in ORDER_FILTERS ? (value as OrderFilterKey) : "pendientes";
}

/** Filtro por la factura de la orden (specs/024, RF-21). */
export const INVOICE_FILTERS = {
  todas: "Todas",
  "sin-factura": "Sin factura",
  "sin-subir": "Sin subir a Mercado Libre",
  pendiente: "Pendiente de ARCA",
  subida: "Subida",
  "ya-tenia": "Ya tenía factura en Mercado Libre",
} as const;

export type InvoiceFilterKey = keyof typeof INVOICE_FILTERS;

export function parseInvoiceFilter(value: string | undefined): InvoiceFilterKey {
  return value && value in INVOICE_FILTERS ? (value as InvoiceFilterKey) : "todas";
}

const ACTIVE_INVOICE = { kind: "FACTURA_C", status: { not: "DISCARDED" } } as const;
/** Sin la nota de «ya tenía factura». El `null` va aparte: SQL deja afuera las que no tienen nota. */
const NOT_EXTERNAL: Prisma.MercadoLibreOrderWhereInput = {
  OR: [{ needsReview: null }, { NOT: { needsReview: { contains: EXTERNAL_INVOICE_NOTE } } }],
};

function invoiceWhere(key: InvoiceFilterKey): Prisma.MercadoLibreOrderWhereInput {
  switch (key) {
    case "sin-factura":
      return { AND: [NOT_EXTERNAL, { sale: { invoices: { none: ACTIVE_INVOICE } } }] };
    case "sin-subir":
      // Lo mismo que cuenta la campanita (RF-23): todo lo que no se subió, menos las canceladas.
      return { AND: [NOT_EXTERNAL, { invoiceUploadedAt: null, status: { not: "CANCELLED" } }] };
    case "pendiente":
      return { sale: { invoices: { some: { kind: "FACTURA_C", status: "PENDING" } } } };
    case "subida":
      return { invoiceUploadedAt: { not: null } };
    case "ya-tenia":
      return { needsReview: { contains: EXTERNAL_INVOICE_NOTE } };
    default:
      return {};
  }
}

/** La factura vigente de la venta, con lo justo para calcular su estado. */
const invoiceInclude = {
  sale: {
    select: {
      invoices: {
        where: ACTIVE_INVOICE,
        select: { id: true, status: true, lastError: true, _count: { select: { creditNotes: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  },
} as const;

type InvoiceRow = { status: "PENDING" | "AUTHORIZED" | "DISCARDED"; _count: { creditNotes: number } };

function stateOf(order: { invoiceUploadedAt: Date | null; needsReview: string | null }, invoice: InvoiceRow | undefined): OrderInvoiceState {
  return orderInvoiceState({
    invoice: invoice && invoice.status !== "DISCARDED" ? { status: invoice.status, hasCreditNote: invoice._count.creditNotes > 0 } : null,
    uploadedAt: order.invoiceUploadedAt,
    externalInvoice: (order.needsReview ?? "").includes(EXTERNAL_INVOICE_NOTE),
  });
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
  invoiceState: OrderInvoiceState;
};

export async function loadOrders(filter: {
  key: OrderFilterKey;
  invoice?: InvoiceFilterKey;
  from?: Date;
  to?: Date;
}): Promise<OrderRow[]> {
  const statuses = ORDER_FILTERS[filter.key].statuses;
  const where: Prisma.MercadoLibreOrderWhereInput = {
    ...(statuses ? { status: { in: [...statuses] } } : {}),
    ...(filter.from || filter.to ? { mlCreatedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
    ...invoiceWhere(filter.invoice ?? "todas"),
  };
  const rows = await prisma.mercadoLibreOrder.findMany({
    where,
    include: { items: { select: { title: true, quantity: true } }, ...invoiceInclude },
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
    invoiceState: stateOf(o, o.sale?.invoices[0]),
  }));
}

export async function loadOrderDetail(id: string) {
  const order = await prisma.mercadoLibreOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, name: true, currentStock: true } } } },
      events: { orderBy: { at: "asc" } },
      sale: {
        select: {
          id: true,
          ticketNumber: true,
          voidedAt: true,
          invoices: {
            where: { kind: "FACTURA_C" },
            select: {
              id: true,
              status: true,
              number: true,
              pointOfSale: true,
              lastError: true,
              creditNotes: { select: { id: true, status: true, number: true, pointOfSale: true }, take: 1 },
              _count: { select: { creditNotes: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      labelPrintedByUser: { select: { name: true } },
    },
  });
  if (!order) return null;
  // La factura vigente (no descartada) y su estado frente a Mercado Libre (RF-15).
  const invoice = order.sale?.invoices.find((i) => i.status !== "DISCARDED") ?? null;
  return { ...order, invoice, invoiceState: stateOf(order, invoice ?? undefined) };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
