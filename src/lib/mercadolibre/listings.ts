import "server-only";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MlError, MlReconnectRequiredError } from "./errors";
import { publishableQuantity } from "./link-preview";
import type { MlItem } from "./listing-read";
import { readListing } from "./listing-read";
import { reconcile, type ReconcileMode, type ReconcileResult } from "./listing-reconcile";
import { mapListingStatus } from "./listing-status";
import { describeMlRejection, getListings, updateListing, type ListingChanges } from "./listings-api";
import { skuKeyOf } from "./sku";

// Lo que toca la base en las publicaciones vinculadas (specs/020, plan
// secciones 3.4 y 3.5; specs/021, plan sección 3): aplicar lo que se leyó de
// Mercado Libre, la bandeja de salida de precio, pausa y cantidad, y el
// control completo.

/** Envíos a Mercado Libre en paralelo (specs/021, plan, riesgo 1). */
const PUSH_CONCURRENCY = 5;

/** Mensaje en español para cualquier error al hablar con Mercado Libre. */
export function mlErrorMessage(error: unknown): string {
  const rejection = describeMlRejection(error);
  if (rejection) return rejection;
  if (error instanceof MlError) return error.message;
  return "No se pudo hablar con Mercado Libre.";
}

/**
 * Aplica a una publicación vinculada lo que se acaba de leer de Mercado Libre:
 * estado, precio, SKU y cantidad (specs/020 RF-3, RF-14, RF-15; specs/021
 * RF-11). Todo en una transacción. Correrla dos veces con la misma lectura no
 * cambia nada la segunda vez. Si la cantidad hay que enviarla, la deja marcada
 * como pendiente; el envío lo hace quien llama.
 * Devuelve `null` si la publicación ya no está vinculada o estaba finalizada.
 */
export async function applyListingRead(
  mlItemId: string,
  item: MlItem,
  mode: ReconcileMode = "notification",
): Promise<ReconcileResult | null> {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.mercadoLibreListing.findUnique({
      where: { mlItemId },
      include: {
        product: { select: { id: true, salePrice: true, purchasePrice: true, sku: true, skuKey: true, currentStock: true } },
      },
    });
    if (!listing || listing.status === "CLOSED") return null;
    const { product } = listing;

    const read = readListing(item);
    const now = new Date();

    // Le agregaron una segunda variante en Mercado Libre: el sistema ya no sabe
    // a cuál mandarle precio, SKU y cantidad. Solo se toma el estado, se cortan
    // los envíos y se deja el motivo para que el dueño deshaga el vínculo
    // (specs/020, sección 7, cambio 2026-11-19).
    if (read.variationCount > 1) {
      const mapped = mapListingStatus(read.mlStatus, read.mlSubStatus);
      await tx.mercadoLibreListing.update({
        where: { id: listing.id },
        data: {
          status: mapped.status,
          mlStatus: read.mlStatus,
          mlSubStatus: read.mlSubStatus,
          statusReason: mapped.reason,
          lastReadAt: now,
          pricePendingSince: null,
          pausePendingSince: null,
          quantityPendingSince: null,
          lastSyncError: `La publicación ahora tiene ${read.variationCount} variantes: el sistema ya no le cambia precio, SKU ni cantidad. Deshacé el vínculo.`,
        },
      });
      return null;
    }

    const incomingKey = read.sku ? skuKeyOf(read.sku) : null;
    const incomingSkuTakenByOther =
      incomingKey !== null && incomingKey !== product.skuKey
        ? (await tx.product.count({ where: { skuKey: incomingKey, id: { not: product.id } } })) > 0
        : false;

    const result = reconcile({
      stored: {
        status: listing.status,
        pricePending: listing.pricePendingSince !== null,
        quantityPending: listing.quantityPendingSince !== null,
        skuConflict: listing.skuConflict,
      },
      product: { salePrice: product.salePrice.toString(), sku: product.sku, currentStock: product.currentStock },
      read,
      incomingSkuTakenByOther,
      mode,
    });

    await tx.mercadoLibreListing.update({
      where: { id: listing.id },
      data: {
        ...result.listing,
        mlVariationId: read.variationId,
        lastReadAt: now,
        ...(result.pushQuantity && listing.quantityPendingSince === null ? { quantityPendingSince: now } : {}),
        ...(result.closed
          ? { closedAt: now, linkedProductId: null, pricePendingSince: null, pausePendingSince: null, quantityPendingSince: null }
          : {}),
      },
    });

    if (result.newSalePrice !== null) {
      await tx.product.update({ where: { id: product.id }, data: { salePrice: result.newSalePrice } });
      await tx.productPriceHistory.create({
        data: {
          productId: product.id,
          purchasePrice: product.purchasePrice,
          salePrice: result.newSalePrice,
          source: "MERCADO_LIBRE",
          changedByUserId: null,
        },
      });
    }
    if (result.newProductSku !== null) {
      await tx.product.update({ where: { id: product.id }, data: result.newProductSku });
    }
    if (result.notification !== null) {
      await tx.notification.create({
        data: { type: "ML_PUBLICACION", message: result.notification, targetType: "MercadoLibreListing", targetId: listing.id },
      });
    }
    return result;
  });
}

/**
 * Marca para enviar a Mercado Libre el precio de venta de esos productos
 * (RF-13). Se llama dentro de la misma transacción que cambia el precio: si
 * la transacción falla, no queda nada marcado.
 */
export async function markPricePending(tx: Prisma.TransactionClient, productIds: string[]): Promise<number> {
  if (productIds.length === 0) return 0;
  const { count } = await tx.mercadoLibreListing.updateMany({
    where: { linkedProductId: { in: productIds } },
    data: { pricePendingSince: new Date() },
  });
  return count;
}

/** Marca para pausar la publicación vigente y activa del producto (RF-18). */
export async function markPausePending(tx: Prisma.TransactionClient, productId: string): Promise<number> {
  const { count } = await tx.mercadoLibreListing.updateMany({
    where: { linkedProductId: productId, status: "ACTIVE" },
    data: { pausePendingSince: new Date() },
  });
  return count;
}

export type PushSummary = { sent: number; failed: number };

type PendingListing = Prisma.MercadoLibreListingGetPayload<{ include: { product: { select: { salePrice: true; currentStock: true } } } }>;

/** Envía lo pendiente de una publicación. Devuelve `false` si falló. Nunca lanza, salvo sin conexión. */
async function pushOne(listing: PendingListing): Promise<boolean> {
  const changes: ListingChanges = {};
  if (listing.pricePendingSince) changes.price = listing.product.salePrice.toString();
  if (listing.pausePendingSince) changes.status = "paused";
  // Se lee el stock ahora: si hubo dos movimientos seguidos, va el último (specs/021, RF-5).
  if (listing.quantityPendingSince) changes.quantity = publishableQuantity(listing.product.currentStock);

  let item: MlItem;
  try {
    item = await updateListing(listing.mlItemId, changes, listing.mlVariationId);
  } catch (error) {
    await prisma.mercadoLibreListing.update({ where: { id: listing.id }, data: { lastSyncError: mlErrorMessage(error) } });
    if (error instanceof MlReconnectRequiredError) throw error;
    return false;
  }

  // Se borra cada marca solo si nadie volvió a marcar mientras se enviaba.
  await prisma.mercadoLibreListing.updateMany({
    where: { id: listing.id, pricePendingSince: listing.pricePendingSince },
    data: { pricePendingSince: null },
  });
  await prisma.mercadoLibreListing.updateMany({
    where: { id: listing.id, pausePendingSince: listing.pausePendingSince },
    data: { pausePendingSince: null },
  });
  await prisma.mercadoLibreListing.updateMany({
    where: { id: listing.id, quantityPendingSince: listing.quantityPendingSince },
    data: { quantityPendingSince: null },
  });
  // La pausa la hizo el sistema: se guarda el estado antes de aplicar la
  // lectura, para que no se tome como un cambio de Mercado Libre (RF-14).
  const ownStatus = changes.status ? { status: mapListingStatus(item.status, item.sub_status ?? []).status } : {};
  const quantitySynced = changes.quantity !== undefined ? { lastQuantitySyncAt: new Date() } : {};
  await prisma.mercadoLibreListing.update({
    where: { id: listing.id },
    data: { lastSyncError: null, ...ownStatus, ...quantitySynced },
  });
  await applyListingRead(listing.mlItemId, item);
  return true;
}

/**
 * Envía lo pendiente (precio, pausa y cantidad) de las publicaciones vigentes,
 * de a varias en paralelo. Cada envío lleva los valores completos, así que
 * repetirlo no cambia nada. Lo que falla queda marcado para el próximo intento.
 * Sin conexión se corta y lanza el error.
 */
export async function pushPendingListings(filter: { productIds?: string[]; listingIds?: string[] } = {}): Promise<PushSummary> {
  const pending = await prisma.mercadoLibreListing.findMany({
    where: {
      linkedProductId: filter.productIds ? { in: filter.productIds } : { not: null },
      ...(filter.listingIds ? { id: { in: filter.listingIds } } : {}),
      OR: [{ pricePendingSince: { not: null } }, { pausePendingSince: { not: null } }, { quantityPendingSince: { not: null } }],
    },
    include: { product: { select: { salePrice: true, currentStock: true } } },
  });

  const summary: PushSummary = { sent: 0, failed: 0 };
  for (let i = 0; i < pending.length; i += PUSH_CONCURRENCY) {
    const results = await Promise.all(pending.slice(i, i + PUSH_CONCURRENCY).map(pushOne));
    for (const ok of results) {
      if (ok) summary.sent++;
      else summary.failed++;
    }
  }
  return summary;
}

/** Igual que `pushPendingListings`, para usar con `after`: nunca deja un error suelto. */
export async function pushPendingListingsSafely(filter: { productIds?: string[]; listingIds?: string[] } = {}) {
  try {
    await pushPendingListings(filter);
  } catch (error) {
    console.error("No se pudieron enviar los cambios pendientes a Mercado Libre", error);
  }
}

/**
 * Agenda el envío de lo pendiente de esos productos para después de responder
 * (specs/021, plan sección 3.2). Se llama una vez por acción, después de su
 * transacción. Nunca lanza: fuera de un pedido (un script) no hace nada, y lo
 * que no se envíe lo toman los reintentos, porque la marca ya quedó.
 */
export function scheduleListingPush(productIds: string[]) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return;
  try {
    after(() => pushPendingListingsSafely({ productIds: ids }));
  } catch {
    // fuera de un pedido: lo envían los reintentos
  }
}

export type SyncSummary = {
  reviewed: number;
  corrected: number;
  failed: { title: string; reason: string }[];
};

/**
 * Control completo (specs/021, RF-8 y RF-9): envía lo pendiente, lee todas las
 * publicaciones vigentes, corrige las diferencias (manda el sistema) y vuelve a
 * enviar. También cubre los avisos que se perdieron (specs/020, sección 7).
 */
export async function syncAllListings(): Promise<SyncSummary> {
  await pushPendingListings();

  const linked = await prisma.mercadoLibreListing.findMany({
    where: { linkedProductId: { not: null } },
    select: { mlItemId: true },
  });
  let corrected = 0;
  let reviewed = 0;
  if (linked.length > 0) {
    const items = await getListings(linked.map((l) => l.mlItemId));
    reviewed = items.length;
    for (const item of items) {
      const result = await applyListingRead(item.id, item, "control");
      if (result && (result.pushQuantity || result.pushPendingPrice)) corrected++;
    }
    await pushPendingListings();
  }

  const stillPending = await prisma.mercadoLibreListing.findMany({
    where: {
      linkedProductId: { not: null },
      OR: [{ pricePendingSince: { not: null } }, { pausePendingSince: { not: null } }, { quantityPendingSince: { not: null } }],
    },
    select: { title: true, lastSyncError: true },
  });
  return {
    reviewed,
    corrected,
    failed: stillPending.map((l) => ({ title: l.title, reason: l.lastSyncError ?? "Sin enviar todavía." })),
  };
}

/** Igual que `syncAllListings`, para usar con `after` (al reconectar la cuenta). */
export async function syncAllListingsSafely() {
  try {
    await syncAllListings();
  } catch (error) {
    console.error("No se pudo hacer el control completo de Mercado Libre", error);
  }
}
