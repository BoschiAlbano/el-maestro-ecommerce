import "server-only";
import type { MlOrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { registerStockMovement } from "@/lib/stock";
import { authorizeAfterSale, createCreditNoteInTx } from "@/lib/facturacion/invoices";
import { decideOnVoid } from "@/lib/facturacion/invoice-policy";
import { pushPendingListingsSafely } from "../listings";
import { getDispatchDeadline, getOrder, getPack, getSellerShippingCost, getShipment, searchOrderIds } from "./orders-api";
import { readOrder, readShipment, purchaseKey, type OrderRead, type ShipmentRead } from "./order-read";
import { buildMlSale, describePurchase, isBeforeStart, isPartiallyCancelled, isPurchaseCancelled, isPurchasePaid } from "./order-sale";
import { cancellationEffect, mapOrderStatus, NOT_YET_SHIPPED, ORDER_STATUS_LABELS, statusTimestamps } from "./order-status";
import { SYSTEM_USER_ID } from "./system-user";

// Compras de Mercado Libre en el sistema (specs/022, plan secciones 3.2 a 3.5).
// Toda función que reciba un aviso lee la compra a Mercado Libre y nunca usa
// el aviso como dato; correrla dos veces no duplica nada.

/** Cuántos días hacia atrás busca «Buscar órdenes nuevas» (plan, sección 3.5). */
const SEARCH_DAYS = 14;
/** Al abrir la pantalla, como mucho una búsqueda por minuto. */
const SEARCH_THROTTLE_MS = 60_000;

function money(value: string | number): string {
  return `$${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

type Purchase = { key: string; packId: string | null; orders: OrderRead[] };

/** Lee la compra entera: si la orden es parte de un paquete, todas sus órdenes. */
async function loadPurchase(mlOrderId: string): Promise<Purchase> {
  const first = readOrder(await getOrder(mlOrderId));
  if (!first.packId) return { key: purchaseKey(first), packId: null, orders: [first] };
  const pack = await getPack(first.packId);
  const orders = await Promise.all(
    pack.orders.map(async (o) => (o.id === first.mlOrderId ? first : readOrder(await getOrder(o.id)))),
  );
  return { key: purchaseKey(first), packId: first.packId, orders };
}

async function loadShipment(shipmentId: string | null): Promise<{ shipment: ShipmentRead | null; deadline: Date | null; sellerCost: string }> {
  if (!shipmentId) return { shipment: null, deadline: null, sellerCost: "0" };
  const [shipment, deadline, sellerCost] = await Promise.all([
    getShipment(shipmentId).then(readShipment),
    getDispatchDeadline(shipmentId).catch(() => null),
    getSellerShippingCost(shipmentId).catch(() => "0"),
  ]);
  return { shipment, deadline, sellerCost };
}

export type SyncResult = "registered" | "updated" | "skipped";

/**
 * Registra o actualiza la compra a la que pertenece esa orden (RF-1 a RF-10b,
 * RF-12, RF-19, RF-20). Si Mercado Libre no responde, el error sube y el aviso
 * queda pendiente (spec 019): nunca queda una venta a medias.
 */
export async function syncOrder(mlOrderId: string): Promise<SyncResult> {
  const purchase = await loadPurchase(mlOrderId);
  const existing = await prisma.mercadoLibreOrder.findUnique({ where: { mlKey: purchase.key } });
  if (existing) {
    await updatePurchase(existing.id, purchase);
    return "updated";
  }

  const settings = await prisma.setting.findUnique({ where: { id: "singleton" }, select: { mlOrdersStartDate: true } });
  const createdAt = new Date(Math.min(...purchase.orders.map((o) => o.createdAt.getTime())));
  if (isBeforeStart(createdAt, settings?.mlOrdersStartDate ?? null)) return "skipped";
  // Sin pagar todavía, o cancelada antes de que el sistema la viera: no se registra.
  if (!isPurchasePaid(purchase.orders)) return "skipped";

  const registered = await registerPurchase(purchase, createdAt);
  if (registered.productIds.length > 0) await pushPendingListingsSafely({ productIds: registered.productIds });
  return registered.created ? "registered" : "updated";
}

async function registerPurchase(purchase: Purchase, createdAt: Date): Promise<{ created: boolean; productIds: string[] }> {
  const shipmentId = purchase.orders.find((o) => o.shipmentId)?.shipmentId ?? null;
  const { shipment, deadline, sellerCost } = await loadShipment(shipmentId);

  const itemIds = [...new Set(purchase.orders.flatMap((o) => o.items.map((i) => i.mlItemId)))];
  const listings = await prisma.mercadoLibreListing.findMany({
    where: { mlItemId: { in: itemIds } },
    select: { mlItemId: true, productId: true },
  });
  const links = new Map(listings.map((l) => [l.mlItemId, l.productId]));
  const sale = buildMlSale(purchase.orders, links, sellerCost);

  const productIds = [...new Set(sale.items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  const fraudRisk = purchase.orders.some((o) => o.fraudRisk);
  const status = mapOrderStatus({
    cancelled: false,
    shipmentStatus: shipment?.status ?? null,
    shipmentSubstatus: shipment?.substatus ?? null,
  });
  const buyer = purchase.orders[0].buyerNickname;
  const label = describePurchase(purchase.packId ?? purchase.orders[0].mlOrderId, sale.items);

  try {
    await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, purchasePrice: true } });
      const costById = new Map(products.map((p) => [p.id, p.purchasePrice]));

      const created = await tx.sale.create({
        data: { channel: "MERCADO_LIBRE", userId: SYSTEM_USER_ID, total: sale.total, createdAt },
      });

      const saleItemIdByIndex = new Map<number, string>();
      let outOfStock = false;
      for (const [index, item] of sale.items.entries()) {
        if (!item.productId) continue;
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: created.id,
            productId: item.productId,
            quantity: item.quantity,
            unitSalePrice: item.unitPrice,
            unitCost: costById.get(item.productId) ?? 0,
          },
        });
        saleItemIdByIndex.set(index, saleItem.id);
        await registerStockMovement(tx, {
          productId: item.productId,
          type: "VENTA",
          quantity: -item.quantity,
          userId: SYSTEM_USER_ID,
          saleId: created.id,
        });
      }
      if (productIds.length > 0) {
        const negatives = await tx.product.count({ where: { id: { in: productIds }, currentStock: { lt: 0 } } });
        outOfStock = negatives > 0;
      }

      const order = await tx.mercadoLibreOrder.create({
        data: {
          mlKey: purchase.key,
          mlOrderIds: purchase.orders.map((o) => o.mlOrderId),
          mlPackId: purchase.packId,
          saleId: created.id,
          status,
          mlShipmentId: shipment?.shipmentId ?? shipmentId,
          shipmentStatus: shipment?.status ?? null,
          shipmentSubstatus: shipment?.substatus ?? null,
          dispatchDeadline: deadline,
          buyerNickname: buyer,
          receiverName: shipment?.receiverName ?? null,
          destinationCity: shipment?.destinationCity ?? null,
          total: sale.total,
          mlFee: sale.mlFee,
          sellerShippingCost: sale.sellerShippingCost,
          net: sale.net,
          outOfStock,
          fraudRisk,
          needsReview: sale.needsReview,
          mlCreatedAt: createdAt,
          items: {
            create: sale.items.map((item, index) => ({
              mlOrderId: item.mlOrderId,
              mlItemId: item.mlItemId,
              mlVariationId: item.mlVariationId,
              title: item.title,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              saleFee: item.saleFee,
              productId: item.productId,
              saleItemId: saleItemIdByIndex.get(index) ?? null,
            })),
          },
          events: { create: { status, detail: "Compra registrada." } },
        },
      });

      const units = sale.items.reduce((sum, i) => sum + i.quantity, 0);
      const notifications: { type: "ML_VENTA" | "ML_VENTA_SIN_STOCK" | "ML_FRAUDE"; message: string }[] = [
        {
          type: "ML_VENTA",
          message: `Venta de Mercado Libre ${label}: ${units} ${units === 1 ? "unidad" : "unidades"} por ${money(sale.total)} (${buyer}).`,
        },
      ];
      if (outOfStock) {
        notifications.push({
          type: "ML_VENTA_SIN_STOCK",
          message: `Venta de Mercado Libre ${label} sin stock: conseguí el producto o cancelá la compra en Mercado Libre.`,
        });
      }
      if (fraudRisk) {
        notifications.push({ type: "ML_FRAUDE", message: `Mercado Libre marcó con riesgo de fraude la compra ${label} de ${buyer}: no la despaches.` });
      }
      await tx.notification.createMany({
        data: notifications.map((n) => ({ ...n, targetType: "MercadoLibreOrder", targetId: order.id })),
      });
    });
  } catch (error) {
    // Otro proceso la registró al mismo tiempo: la restricción única de `mlKey` deshizo todo (RF-8).
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { created: false, productIds: [] };
    }
    throw error;
  }
  return { created: true, productIds };
}

/** Estado, envío y cancelaciones de una compra ya registrada (plan, secciones 3.3 y 3.4). */
async function updatePurchase(orderId: string, purchase: Purchase): Promise<void> {
  const current = await prisma.mercadoLibreOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, sale: { select: { id: true, voidedAt: true } } },
  });
  // Ya cancelada y procesada: no cambia más. (Una que quedó marcada como
  // cancelada sin `cancelledAt` se procesa abajo, si la orden lo confirma.)
  if (current.cancelledAt) return;

  if (isPurchaseCancelled(purchase.orders)) {
    await cancelPurchase(current, purchase);
    return;
  }

  const { shipment, deadline } = await loadShipment(current.mlShipmentId);
  // Un envío cancelado sin la orden cancelada no cambia el estado: la
  // cancelación llega con la orden.
  const status =
    shipment?.status === "cancelled"
      ? current.status === "CANCELLED"
        ? "TO_PREPARE"
        : current.status
      : mapOrderStatus({
          cancelled: false,
          shipmentStatus: shipment?.status ?? null,
          shipmentSubstatus: shipment?.substatus ?? null,
        });
  const fraudRisk = purchase.orders.some((o) => o.fraudRisk);
  const partial = isPartiallyCancelled(purchase.orders);
  const now = new Date();
  const times = statusTimestamps(status, now);

  // Mercado Libre manda varios avisos de un mismo cambio casi juntos, y se
  // procesan en paralelo. Cada actualización es condicional a lo que se leyó:
  // la base las ordena y solo la primera cambia algo; las demás no encuentran
  // la fila como estaba y no repiten ni el evento ni el aviso.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.mercadoLibreOrder.updateMany({
      where: { id: current.id, status: current.status },
      data: {
        status,
        shipmentStatus: shipment?.status ?? current.shipmentStatus,
        shipmentSubstatus: shipment?.substatus ?? current.shipmentSubstatus,
        ...(NOT_YET_SHIPPED.includes(status) && deadline ? { dispatchDeadline: deadline } : {}),
        shippedAt: current.shippedAt ?? times.shippedAt ?? null,
        deliveredAt: current.deliveredAt ?? times.deliveredAt ?? null,
        ...(partial && !current.needsReview
          ? { needsReview: "Se canceló una parte del paquete: revisá la compra en Mercado Libre. El stock no se tocó." }
          : {}),
      },
    });
    if (updated.count > 0 && status !== current.status) {
      await tx.mercadoLibreOrderEvent.create({ data: { orderId: current.id, status } });
    }
    const flagged = fraudRisk
      ? await tx.mercadoLibreOrder.updateMany({ where: { id: current.id, fraudRisk: false }, data: { fraudRisk: true } })
      : { count: 0 };
    if (flagged.count > 0) {
      await tx.notification.create({
        data: {
          type: "ML_FRAUDE",
          message: `Mercado Libre marcó con riesgo de fraude la compra ${describePurchase(current.mlPackId ?? current.mlOrderIds[0], current.items)} de ${current.buyerNickname}: no la despaches.`,
          targetType: "MercadoLibreOrder",
          targetId: current.id,
        },
      });
    }
  });
}

type CurrentOrder = Prisma.MercadoLibreOrderGetPayload<{
  include: { items: true; sale: { select: { id: true; voidedAt: true } } };
}>;

/** RF-19 y RF-20: antes del despacho vuelve el stock; después, no. */
async function cancelPurchase(current: CurrentOrder, purchase: Purchase): Promise<void> {
  const effect = cancellationEffect({ shippedAt: current.shippedAt, previousStatus: current.status });
  const reason = purchase.orders.find((o) => o.cancelReason)?.cancelReason ?? "Cancelada en Mercado Libre.";
  const cancelledAt = purchase.orders.find((o) => o.cancelledAt)?.cancelledAt ?? new Date();
  const productIds = [...new Set(current.items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  const label = describePurchase(current.mlPackId ?? current.mlOrderIds[0], current.items);

  // Comprobantes para autorizar en ARCA después de la transacción (specs/024, RF-20).
  const toAuthorize: string[] = [];

  // Primero se reclama la cancelación con una actualización condicional: si
  // llegan varios avisos juntos, la base las ordena y solo la primera la hace.
  // Las demás no anulan, no devuelven stock ni avisan otra vez.
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.mercadoLibreOrder.updateMany({
      where: { id: current.id, cancelledAt: null },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt },
    });
    if (claim.count === 0) return false;

    const voided = current.sale
      ? await tx.sale.updateMany({
          where: { id: current.sale.id, voidedAt: null },
          data: { voidedAt: new Date(), voidedByUserId: SYSTEM_USER_ID, voidReason: `Mercado Libre: ${reason}` },
        })
      : { count: 0 };
    if (voided.count > 0 && current.sale) {
      if (effect === "return_stock") {
        for (const item of current.items) {
          if (!item.productId) continue;
          await registerStockMovement(tx, {
            productId: item.productId,
            type: "VENTA",
            quantity: item.quantity,
            reason: "Compra de Mercado Libre cancelada antes del despacho",
            userId: SYSTEM_USER_ID,
            saleId: current.sale.id,
          });
        }
      }
    }

    // La factura de la venta (specs/024, RF-19 y RF-20; regla de la spec 023): si ya existe en
    // ARCA se anula con una nota de crédito; si quedó pendiente, se averigua en ARCA si llegó a
    // autorizarse antes de descartarla. La nota de crédito no se sube a Mercado Libre.
    let creditNote = false;
    if (voided.count > 0 && current.sale) {
      const invoice = await tx.invoice.findFirst({
        where: { saleId: current.sale.id, kind: "FACTURA_C", status: { not: "DISCARDED" } },
        select: { id: true, status: true },
      });
      const decision = decideOnVoid(invoice);
      if (invoice && decision === "credit_note") {
        toAuthorize.push(await createCreditNoteInTx(tx, { invoiceId: invoice.id, userId: SYSTEM_USER_ID }));
        creditNote = true;
      } else if (invoice && decision === "verify_then_decide") {
        toAuthorize.push(invoice.id);
      }
    }
    const invoiceNote = creditNote ? " La factura se anula con una nota de crédito." : "";

    await tx.mercadoLibreOrderEvent.create({
      data: {
        orderId: current.id,
        status: "CANCELLED",
        detail:
          (effect === "return_stock" ? `${reason} Se devolvió el stock.` : `${reason} Ya estaba despachada: el stock no volvió.`) +
          invoiceNote,
      },
    });
    await tx.notification.create({
      data: {
        type: "ML_CANCELACION",
        message:
          (effect === "return_stock"
            ? `Se canceló la compra ${label} en Mercado Libre. Se devolvió el stock.`
            : `Se canceló la compra ${label} después del despacho: cuando vuelva la mercadería, reingresala desde la orden.`) +
          invoiceNote,
        targetType: "MercadoLibreOrder",
        targetId: current.id,
      },
    });
    return true;
  });
  if (claimed && effect === "return_stock" && productIds.length > 0) await pushPendingListingsSafely({ productIds });
  // Nunca lanza: si ARCA no responde, la nota de crédito queda pendiente y se reintenta desde el comprobante.
  for (const id of toAuthorize) await authorizeAfterSale(id);
}

/** Aviso `shipments`: actualiza la compra de ese envío (plan, sección 3.3). */
export async function syncShipment(shipmentId: string): Promise<SyncResult> {
  const order = await prisma.mercadoLibreOrder.findFirst({ where: { mlShipmentId: shipmentId }, select: { mlOrderIds: true } });
  if (order) return syncOrder(order.mlOrderIds[0]);
  return "skipped";
}

export type FetchSummary = { skipped: "no_start_date" | "throttled" | null; found: number; registered: number };

/**
 * «Buscar órdenes nuevas» (RF-14): trae las compras de los últimos días y
 * registra o actualiza las que hagan falta. `force` saltea el límite de una
 * búsqueda por minuto (el botón y la pasada diaria).
 */
export async function fetchRecentOrders(options: { force?: boolean } = {}): Promise<FetchSummary> {
  const [settings, connection] = await Promise.all([
    prisma.setting.findUnique({ where: { id: "singleton" }, select: { mlOrdersStartDate: true } }),
    prisma.mercadoLibreConnection.findUnique({ where: { id: "singleton" }, select: { mlUserId: true, lastOrdersFetchAt: true } }),
  ]);
  if (!connection) return { skipped: null, found: 0, registered: 0 };
  const start = settings?.mlOrdersStartDate ?? null;
  if (!start) return { skipped: "no_start_date", found: 0, registered: 0 };
  const now = new Date();
  if (!options.force && connection.lastOrdersFetchAt && now.getTime() - connection.lastOrdersFetchAt.getTime() < SEARCH_THROTTLE_MS) {
    return { skipped: "throttled", found: 0, registered: 0 };
  }
  await prisma.mercadoLibreConnection.update({ where: { id: "singleton" }, data: { lastOrdersFetchAt: now } });

  const from = new Date(Math.max(start.getTime(), now.getTime() - SEARCH_DAYS * 86_400_000));
  const ids = await searchOrderIds(connection.mlUserId, from);

  // Las órdenes de un mismo paquete se sincronizan una sola vez.
  const known = await prisma.mercadoLibreOrder.findMany({
    where: { mlOrderIds: { hasSome: ids } },
    select: { mlOrderIds: true, status: true },
  });
  const done = new Set<string>();
  let registered = 0;
  for (const id of ids) {
    if (done.has(id)) continue;
    const row = known.find((k) => k.mlOrderIds.includes(id));
    row?.mlOrderIds.forEach((o) => done.add(o));
    // Las terminadas no cambian más.
    if (row && (row.status === "DELIVERED" || row.status === "CANCELLED")) continue;
    const result = await syncOrder(id);
    if (result === "registered") registered++;
    done.add(id);
  }
  return { skipped: null, found: ids.length, registered };
}

/** Igual que `fetchRecentOrders`, para usar con `after` o en la pasada diaria: nunca deja un error suelto. */
export async function fetchRecentOrdersSafely(options: { force?: boolean } = {}): Promise<void> {
  try {
    await fetchRecentOrders(options);
  } catch (error) {
    console.error("No se pudieron buscar las órdenes de Mercado Libre", error);
  }
}

/**
 * «Reingresar al stock» (RF-20): la mercadería de una compra cancelada o no
 * entregada después del despacho volvió en condiciones.
 */
export async function restockOrder(
  orderId: string,
  quantities: Record<string, number>,
  userId: string,
): Promise<{ error?: string; restocked?: number }> {
  const order = await prisma.mercadoLibreOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: "La orden no existe." };
  if (order.status !== "CANCELLED" && order.status !== "NOT_DELIVERED") {
    return { error: "Solo se reingresa el stock de una compra cancelada o no entregada." };
  }

  const moves = order.items.flatMap((item) => {
    const quantity = quantities[item.id] ?? 0;
    return quantity > 0 && item.productId ? [{ item, quantity }] : [];
  });
  if (moves.length === 0) return { error: "Indicá cuántas unidades volvieron." };
  for (const { item, quantity } of moves) {
    if (!Number.isInteger(quantity) || quantity > item.quantity - item.restockedQuantity) {
      return { error: `De «${item.title}» se pueden reingresar como mucho ${item.quantity - item.restockedQuantity}.` };
    }
  }

  const tooMany = new Error("restock_limit");
  try {
    await prisma.$transaction(async (tx) => {
      for (const { item, quantity } of moves) {
        // Condicional: con un doble envío, el segundo no encuentra lugar y se deshace entero.
        const reserved = await tx.mercadoLibreOrderItem.updateMany({
          where: { id: item.id, restockedQuantity: { lte: item.quantity - quantity } },
          data: { restockedQuantity: { increment: quantity } },
        });
        if (reserved.count === 0) throw tooMany;
        await registerStockMovement(tx, {
          productId: item.productId!,
          type: "AJUSTE",
          quantity,
          reason: `Devolución de Mercado Libre, compra ${order.mlPackId ?? order.mlOrderIds[0]}`,
          userId,
        });
      }
      await tx.mercadoLibreOrderEvent.create({
        data: { orderId: order.id, status: order.status, detail: "Mercadería reingresada al stock." },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "ML_ORDER_RESTOCKED",
          targetType: "MercadoLibreOrder",
          targetId: order.id,
          detail: moves.map(({ item, quantity }) => ({ producto: item.title, cantidad: quantity })),
        },
      });
    });
  } catch (error) {
    if (error === tooMany) return { error: "Esas unidades ya se reingresaron. Actualizá la pantalla." };
    throw error;
  }
  await pushPendingListingsSafely({ productIds: moves.map((m) => m.item.productId!) });
  return { restocked: moves.reduce((sum, m) => sum + m.quantity, 0) };
}

export { ORDER_STATUS_LABELS };
export type { MlOrderStatus };
