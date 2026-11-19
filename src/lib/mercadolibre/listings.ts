import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MlError, MlReconnectRequiredError } from "./errors";
import type { MlItem } from "./listing-read";
import { readListing } from "./listing-read";
import { reconcile, type ReconcileResult } from "./listing-reconcile";
import { mapListingStatus } from "./listing-status";
import { describeMlRejection, getListings, updateListing, type ListingChanges } from "./listings-api";
import { skuKeyOf } from "./sku";

// Lo que toca la base en las publicaciones vinculadas (specs/020, plan
// secciones 3.4 y 3.5): aplicar lo que se leyó de Mercado Libre y la bandeja
// de salida de precios y pausas.

/** Mensaje en español para cualquier error al hablar con Mercado Libre. */
export function mlErrorMessage(error: unknown): string {
  const rejection = describeMlRejection(error);
  if (rejection) return rejection;
  if (error instanceof MlError) return error.message;
  return "No se pudo hablar con Mercado Libre.";
}

/**
 * Aplica a una publicación vinculada lo que se acaba de leer de Mercado Libre:
 * estado, precio y SKU (RF-3, RF-14, RF-15). Todo en una transacción. Correrla
 * dos veces con la misma lectura no cambia nada la segunda vez.
 * Devuelve `null` si la publicación ya no está vinculada o estaba finalizada.
 */
export async function applyListingRead(mlItemId: string, item: MlItem): Promise<ReconcileResult | null> {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.mercadoLibreListing.findUnique({
      where: { mlItemId },
      include: { product: { select: { id: true, salePrice: true, purchasePrice: true, sku: true, skuKey: true } } },
    });
    if (!listing || listing.status === "CLOSED") return null;
    const { product } = listing;

    const read = readListing(item);
    const incomingKey = read.sku ? skuKeyOf(read.sku) : null;
    const incomingSkuTakenByOther =
      incomingKey !== null && incomingKey !== product.skuKey
        ? (await tx.product.count({ where: { skuKey: incomingKey, id: { not: product.id } } })) > 0
        : false;

    const result = reconcile({
      stored: { status: listing.status, pricePending: listing.pricePendingSince !== null, skuConflict: listing.skuConflict },
      product: { salePrice: product.salePrice.toString(), sku: product.sku },
      read,
      incomingSkuTakenByOther,
    });

    const now = new Date();
    await tx.mercadoLibreListing.update({
      where: { id: listing.id },
      data: {
        ...result.listing,
        lastReadAt: now,
        ...(result.closed ? { closedAt: now, linkedProductId: null, pricePendingSince: null, pausePendingSince: null } : {}),
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

/**
 * Envía lo pendiente (precio y pausa) de las publicaciones vigentes. Lee el
 * producto en el momento del envío: si el precio cambió dos veces seguidas,
 * va el último. Cada envío lleva el precio completo, así que repetirlo no
 * cambia nada. Nunca lanza: lo que falla queda marcado para el próximo intento.
 */
export async function pushPendingListings(filter: { productIds?: string[]; listingIds?: string[] } = {}): Promise<PushSummary> {
  const pending = await prisma.mercadoLibreListing.findMany({
    where: {
      linkedProductId: filter.productIds ? { in: filter.productIds } : { not: null },
      ...(filter.listingIds ? { id: { in: filter.listingIds } } : {}),
      OR: [{ pricePendingSince: { not: null } }, { pausePendingSince: { not: null } }],
    },
    include: { product: { select: { salePrice: true } } },
  });

  const summary: PushSummary = { sent: 0, failed: 0 };
  for (const listing of pending) {
    const changes: ListingChanges = {};
    if (listing.pricePendingSince) changes.price = listing.product.salePrice.toString();
    if (listing.pausePendingSince) changes.status = "paused";

    let item: MlItem;
    try {
      item = await updateListing(listing.mlItemId, changes);
    } catch (error) {
      summary.failed++;
      await prisma.mercadoLibreListing.update({ where: { id: listing.id }, data: { lastSyncError: mlErrorMessage(error) } });
      // Sin conexión no tiene sentido seguir con las demás.
      if (error instanceof MlReconnectRequiredError) break;
      continue;
    }

    // Se borra la marca solo si nadie volvió a marcar mientras se enviaba.
    await prisma.mercadoLibreListing.updateMany({
      where: { id: listing.id, pricePendingSince: listing.pricePendingSince },
      data: { pricePendingSince: null },
    });
    await prisma.mercadoLibreListing.updateMany({
      where: { id: listing.id, pausePendingSince: listing.pausePendingSince },
      data: { pausePendingSince: null },
    });
    // La pausa la hizo el sistema: se guarda el estado antes de aplicar la
    // lectura, para que no se tome como un cambio de Mercado Libre (RF-14).
    const ownStatus = changes.status ? { status: mapListingStatus(item.status, item.sub_status ?? []).status } : {};
    await prisma.mercadoLibreListing.update({ where: { id: listing.id }, data: { lastSyncError: null, ...ownStatus } });
    await applyListingRead(listing.mlItemId, item);
    summary.sent++;
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
 * Lee de nuevo todas las publicaciones vigentes y aplica lo que haya cambiado
 * (pasada diaria): cubre los avisos que se perdieron (specs/020, sección 7).
 */
export async function rereadLinkedListings(): Promise<number> {
  const linked = await prisma.mercadoLibreListing.findMany({
    where: { linkedProductId: { not: null } },
    select: { mlItemId: true },
  });
  if (linked.length === 0) return 0;
  const items = await getListings(linked.map((l) => l.mlItemId));
  for (const item of items) await applyListingRead(item.id, item);
  return items.length;
}
