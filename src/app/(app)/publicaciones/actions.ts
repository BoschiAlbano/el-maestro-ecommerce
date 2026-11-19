"use server";

import { revalidatePath } from "next/cache";
import { ModuloNegocio } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildLinkPreview } from "@/lib/mercadolibre/link-preview";
import { readListing, type MlItem } from "@/lib/mercadolibre/listing-read";
import { mapListingStatus } from "@/lib/mercadolibre/listing-status";
import { getListing, updateListing, type ListingChanges } from "@/lib/mercadolibre/listings-api";
import { applyListingRead, mlErrorMessage, pushPendingListings } from "@/lib/mercadolibre/listings";
import { normalizeSku } from "@/lib/mercadolibre/sku";
import { requireMlConnection, searchLinkableProducts } from "@/lib/mercadolibre/listings-view";

// Acciones sobre las publicaciones de Mercado Libre (specs/020, plan
// secciones 3.3 y 3.6). Todas validan el permiso en el servidor y que haya
// una cuenta conectada.

export type LinkResult = { mlItemId: string; ok: boolean; message: string };
export type ListingActionState = { error?: string; success?: string };

function revalidate() {
  revalidatePath("/publicaciones");
  revalidatePath("/publicaciones/vincular");
}

async function linkOne(pair: { mlItemId: string; productId: string }, userId: string): Promise<LinkResult> {
  const fail = (message: string): LinkResult => ({ mlItemId: pair.mlItemId, ok: false, message });

  // Se vuelve a leer todo: lo que vio el usuario puede estar viejo.
  let item: MlItem;
  try {
    item = await getListing(pair.mlItemId);
  } catch (error) {
    return fail(mlErrorMessage(error));
  }
  const read = readListing(item);
  if (read.notLinkableReason) return fail(read.notLinkableReason);

  const already = await prisma.mercadoLibreListing.findUnique({ where: { mlItemId: pair.mlItemId } });
  if (already) return fail("La publicación ya está vinculada.");

  const product = await prisma.product.findUnique({
    where: { id: pair.productId },
    select: { id: true, active: true, salePrice: true, currentStock: true, sku: true, mlLinkedListing: { select: { id: true } } },
  });
  if (!product || !product.active) return fail("El producto no existe o está desactivado.");
  if (product.mlLinkedListing) return fail("El producto ya tiene una publicación vigente.");

  const preview = buildLinkPreview(
    { salePrice: product.salePrice.toString(), currentStock: product.currentStock, sku: product.sku },
    { price: read.price, quantity: read.quantity, sku: read.sku },
  );

  // Producto sin SKU que toma el de la publicación (RF-8).
  let takenSku: { sku: string; skuKey: string } | null = null;
  if (preview.productTakesListingSku && read.sku) {
    const normalized = normalizeSku(read.sku);
    if (!normalized.ok) {
      return fail(`El SKU de la publicación («${read.sku}») no sirve en el sistema: ${normalized.error} Cargale un SKU al producto y volvé a vincular.`);
    }
    const owner = await prisma.product.findUnique({ where: { skuKey: normalized.skuKey }, select: { id: true } });
    if (owner && owner.id !== product.id) return fail("El SKU de la publicación es de otro producto.");
    takenSku = { sku: normalized.sku, skuKey: normalized.skuKey };
  }

  // Al vincular manda el sistema: precio, cantidad y SKU del producto.
  const changes: ListingChanges = {};
  if (preview.price.changes) changes.price = preview.price.to;
  if (preview.quantity.changes) changes.quantity = preview.quantity.to;
  if (preview.sku.changes && preview.sku.to !== null) changes.sku = preview.sku.to;

  let updated = item;
  if (Object.keys(changes).length > 0) {
    try {
      updated = await updateListing(pair.mlItemId, changes);
    } catch (error) {
      return fail(mlErrorMessage(error));
    }
  }
  const final = readListing(updated);
  const status = mapListingStatus(final.mlStatus, final.mlSubStatus);

  try {
    await prisma.$transaction(async (tx) => {
      const listing = await tx.mercadoLibreListing.create({
        data: {
          mlItemId: final.mlItemId,
          productId: product.id,
          linkedProductId: product.id,
          title: final.title,
          thumbnailUrl: final.thumbnailUrl,
          permalink: final.permalink,
          categoryId: final.categoryId,
          status: status.status,
          mlStatus: final.mlStatus,
          mlSubStatus: final.mlSubStatus,
          statusReason: status.reason,
          lastKnownPrice: final.price,
          lastKnownSku: final.sku,
          lastReadAt: new Date(),
          linkedByUserId: userId,
        },
      });
      if (takenSku) await tx.product.update({ where: { id: product.id }, data: takenSku });
      await logAudit(tx, {
        userId,
        action: "ML_LISTING_LINKED",
        targetType: "MercadoLibreListing",
        targetId: listing.id,
        detail: { mlItemId: final.mlItemId, productId: product.id, cambios: preview },
      });
    });
  } catch {
    // Mercado Libre ya quedó con los datos del sistema; volver a vincular no cambia nada allá.
    return fail("La publicación quedó con los datos del producto, pero no se pudo guardar el vínculo. Probá de nuevo.");
  }
  return { mlItemId: pair.mlItemId, ok: true, message: "Vinculada." };
}

/** Vincula una o varias publicaciones, cada una por separado (RF-6). */
export async function linkListings(pairs: { mlItemId: string; productId: string }[]): Promise<LinkResult[]> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear");
  const connection = await requireMlConnection();
  if (!connection.ok) return pairs.map((p) => ({ mlItemId: p.mlItemId, ok: false, message: connection.error }));

  const results: LinkResult[] = [];
  for (const pair of pairs) results.push(await linkOne(pair, currentUser.id));
  revalidate();
  return results;
}

/** Deshace el vínculo: la publicación sigue en Mercado Libre tal como está (RF-9). */
export async function unlinkListing(listingId: string): Promise<ListingActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "anular");

  const listing = await prisma.mercadoLibreListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.linkedProductId === null) return { error: "La publicación no está vinculada." };

  await prisma.$transaction(async (tx) => {
    await tx.mercadoLibreListing.delete({ where: { id: listingId } });
    await logAudit(tx, {
      userId: currentUser.id,
      action: "ML_LISTING_UNLINKED",
      targetType: "MercadoLibreListing",
      targetId: listingId,
      detail: { mlItemId: listing.mlItemId, productId: listing.productId },
    });
  });
  revalidate();
  return { success: "Se deshizo el vínculo. La publicación sigue en Mercado Libre." };
}

const STATUS_ACTIONS = {
  pause: { mlStatus: "paused", audit: "ML_LISTING_PAUSED", permission: "editar", done: "Publicación pausada." },
  activate: { mlStatus: "active", audit: "ML_LISTING_ACTIVATED", permission: "editar", done: "Publicación reactivada." },
  close: { mlStatus: "closed", audit: "ML_LISTING_CLOSED", permission: "anular", done: "Publicación finalizada." },
} as const;

async function changeStatus(listingId: string, kind: keyof typeof STATUS_ACTIONS): Promise<ListingActionState> {
  const action = STATUS_ACTIONS[kind];
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, action.permission);
  const connection = await requireMlConnection();
  if (!connection.ok) return { error: connection.error };

  const listing = await prisma.mercadoLibreListing.findUnique({
    where: { id: listingId },
    include: { product: { select: { active: true } } },
  });
  if (!listing || listing.linkedProductId === null) return { error: "La publicación no está vinculada o ya está finalizada." };
  if (kind === "activate" && !listing.product.active) {
    return { error: "El producto está desactivado: reactivalo primero en el catálogo." };
  }

  // Primero Mercado Libre: si no responde, no se guarda nada (specs/020, sección 7).
  let item: MlItem;
  try {
    item = await updateListing(listing.mlItemId, { status: action.mlStatus });
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }

  // Lo que el sistema hizo no es un cambio de Mercado Libre: se guarda el
  // estado antes de aplicar la lectura, para que no genere un aviso.
  const mapped = mapListingStatus(item.status, item.sub_status ?? []);
  const closed = mapped.status === "CLOSED";
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.mercadoLibreListing.update({
      where: { id: listing.id },
      data: {
        status: mapped.status,
        mlStatus: item.status,
        mlSubStatus: item.sub_status ?? [],
        statusReason: mapped.reason,
        lastReadAt: now,
        ...(kind === "pause" ? { pausePendingSince: null } : {}),
        // Finalizada: el producto queda libre para otra publicación (RF-17).
        ...(closed ? { closedAt: now, linkedProductId: null, pricePendingSince: null, pausePendingSince: null } : {}),
      },
    });
    await logAudit(tx, {
      userId: currentUser.id,
      action: action.audit,
      targetType: "MercadoLibreListing",
      targetId: listing.id,
      detail: { mlItemId: listing.mlItemId, estado: item.status },
    });
  });
  // Precio y SKU pueden haber cambiado en Mercado Libre mientras tanto.
  if (!closed) await applyListingRead(listing.mlItemId, item);
  revalidate();

  if (kind === "activate" && mapped.status === "PAUSED_NO_STOCK") {
    return { success: "Mercado Libre la dejó pausada sin stock: el producto no tiene unidades para publicar." };
  }
  return { success: action.done };
}

export async function pauseListing(listingId: string) {
  return changeStatus(listingId, "pause");
}

export async function activateListing(listingId: string) {
  return changeStatus(listingId, "activate");
}

/** Definitivo: la publicación no vuelve y el producto queda libre (RF-17). */
export async function closeListing(listingId: string) {
  return changeStatus(listingId, "close");
}

/** Reintenta los envíos pendientes de precio y pausa (RF-13). */
export async function retryPendingSync(): Promise<ListingActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "editar");
  const connection = await requireMlConnection();
  if (!connection.ok) return { error: connection.error };

  const { sent, failed } = await pushPendingListings();
  revalidate();
  if (failed > 0) return { error: `Se enviaron ${sent} y fallaron ${failed}. Mirá el motivo en cada publicación.` };
  return { success: sent === 0 ? "No había nada pendiente." : `Se enviaron ${sent} cambios a Mercado Libre.` };
}

/** Buscador de productos para vincular a mano (RF-7). */
export async function searchProductsForLink(query: string) {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.MERCADO_LIBRE, "crear");
  return searchLinkableProducts(query);
}
