import "server-only";
import type { MlListingStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isMlConfigured } from "./config";
import { buildLinkPreview, type LinkPreview } from "./link-preview";
import { proposeLinks } from "./link-proposal";
import { readListing, type ListingRead } from "./listing-read";
import { getListings, searchListingIds } from "./listings-api";
import { mlErrorMessage } from "./listings";
import { skuKeyOf } from "./sku";

// Lo que cargan las pantallas de publicaciones (specs/020, plan secciones 3.3
// y 4). Las acciones están en `src/app/(app)/publicaciones/actions.ts`.

export type MlConnectionCheck = { ok: true; mlUserId: string } | { ok: false; error: string };

/** Sin conexión no se administra (specs/020, sección 5; spec 019). */
export async function requireMlConnection(): Promise<MlConnectionCheck> {
  if (!isMlConfigured()) return { ok: false, error: "Mercado Libre no está configurado en el servidor." };
  const connection = await prisma.mercadoLibreConnection.findUnique({
    where: { id: "singleton" },
    select: { mlUserId: true, status: true },
  });
  if (!connection) return { ok: false, error: "No hay una cuenta de Mercado Libre conectada. Conectala en Configuración." };
  if (connection.status !== "CONNECTED") {
    return { ok: false, error: "Hay que volver a conectar la cuenta de Mercado Libre en Configuración." };
  }
  return { ok: true, mlUserId: connection.mlUserId };
}

export type PublicationRow = {
  id: string;
  mlItemId: string;
  permalink: string;
  thumbnailUrl: string | null;
  status: MlListingStatus;
  statusReason: string | null;
  skuConflict: string | null;
  pricePending: boolean;
  pausePending: boolean;
  /** Cantidad sin enviar (specs/021). */
  quantityPending: boolean;
  /** Cantidad que tiene Mercado Libre, según la última lectura o envío; `null` si todavía no se leyó. */
  publishedQuantity: number | null;
  lastSyncError: string | null;
  closedAt: Date | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string;
    salePrice: string;
    currentStock: number;
    active: boolean;
    photoUrl: string | null;
  };
};

export type PublicationsFilter = { status?: MlListingStatus; q?: string };

export async function loadPublications(filter: PublicationsFilter): Promise<PublicationRow[]> {
  const where: Prisma.MercadoLibreListingWhereInput = {};
  // Las finalizadas solo se ven si se filtra por ellas.
  where.status = filter.status ?? { not: "CLOSED" };
  const q = filter.q?.trim();
  if (q) {
    where.product = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { skuKey: { contains: skuKeyOf(q) } },
      ],
    };
  }

  const rows = await prisma.mercadoLibreListing.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, sku: true, barcode: true, salePrice: true, currentStock: true, active: true, photoUrl: true },
      },
    },
    orderBy: [{ status: "asc" }, { product: { name: "asc" } }],
  });

  return rows.map((r) => ({
    id: r.id,
    mlItemId: r.mlItemId,
    permalink: r.permalink,
    thumbnailUrl: r.thumbnailUrl,
    status: r.status,
    statusReason: r.statusReason,
    skuConflict: r.skuConflict,
    pricePending: r.pricePendingSince !== null,
    pausePending: r.pausePendingSince !== null,
    quantityPending: r.quantityPendingSince !== null,
    publishedQuantity: r.lastKnownQuantity,
    lastSyncError: r.lastSyncError,
    closedAt: r.closedAt,
    product: { ...r.product, salePrice: r.product.salePrice.toString() },
  }));
}

/**
 * Publicaciones activas en Mercado Libre que no están vinculadas (RF-10).
 * Si Mercado Libre no responde, devuelve `null` y la pantalla carga igual.
 */
export async function countUnlinkedActive(mlUserId: string): Promise<number | null> {
  try {
    const ids = await searchListingIds(mlUserId, ["active"]);
    if (ids.length === 0) return 0;
    const linked = await prisma.mercadoLibreListing.count({ where: { mlItemId: { in: ids }, linkedProductId: { not: null } } });
    return ids.length - linked;
  } catch {
    return null;
  }
}

export type CandidateProduct = {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  salePrice: string;
  currentStock: number;
};

export type LinkCandidate = {
  listing: ListingRead;
  proposal: { product: CandidateProduct; preview: LinkPreview; matchedBy: "sku" | "barcode" | "gtin" } | null;
  reason: string | null;
};

export type LinkView =
  | { ok: false; error: string }
  | { ok: true; candidates: LinkCandidate[]; notLinkable: ListingRead[] };

/** Publicaciones de la cuenta sin vincular, con su propuesta (RF-4, RF-5). */
export async function loadLinkView(mlUserId: string): Promise<LinkView> {
  let reads: ListingRead[];
  try {
    const ids = await searchListingIds(mlUserId, ["active", "paused", "under_review"]);
    reads = (await getListings(ids)).map(readListing);
  } catch (error) {
    return { ok: false, error: mlErrorMessage(error) };
  }

  const existing = await prisma.mercadoLibreListing.findMany({
    where: { mlItemId: { in: reads.map((r) => r.mlItemId) } },
    select: { mlItemId: true },
  });
  const linkedIds = new Set(existing.map((e) => e.mlItemId));
  const unlinked = reads.filter((r) => !linkedIds.has(r.mlItemId));
  const linkable = unlinked.filter((r) => r.notLinkableReason === null);
  const notLinkable = unlinked.filter((r) => r.notLinkableReason !== null);

  const skuKeys = linkable.flatMap((r) => (r.sku ? [skuKeyOf(r.sku)] : []));
  const barcodes = [...skuKeys, ...linkable.flatMap((r) => r.gtins)];
  const products = await prisma.product.findMany({
    where: { active: true, OR: [{ skuKey: { in: skuKeys } }, { barcode: { in: barcodes } }] },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      skuKey: true,
      salePrice: true,
      currentStock: true,
      mlLinkedListing: { select: { id: true } },
    },
  });
  // El código de barras se compara en mayúsculas contra el SKU (link-proposal).
  const byId = new Map(products.map((p) => [p.id, p]));
  const proposals = proposeLinks(
    linkable.map((r) => ({ mlItemId: r.mlItemId, sku: r.sku, gtins: r.gtins })),
    products.map((p) => ({ id: p.id, skuKey: p.skuKey, barcode: p.barcode, linked: p.mlLinkedListing !== null })),
  );

  const candidates = linkable.map((listing, index): LinkCandidate => {
    const proposal = proposals[index];
    if (proposal.productId === null) return { listing, proposal: null, reason: proposal.reason };
    const p = byId.get(proposal.productId)!;
    const product: CandidateProduct = {
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      salePrice: p.salePrice.toString(),
      currentStock: p.currentStock,
    };
    const preview = buildLinkPreview(product, { price: listing.price, quantity: listing.quantity, sku: listing.sku });
    return { listing, proposal: { product, preview, matchedBy: proposal.matchedBy }, reason: null };
  });

  return { ok: true, candidates, notLinkable };
}

/** Buscador de productos para vincular a mano (RF-7): nombre, código o SKU. */
export async function searchLinkableProducts(query: string): Promise<(CandidateProduct & { linked: boolean })[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { skuKey: { contains: skuKeyOf(q) } },
      ],
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      salePrice: true,
      currentStock: true,
      mlLinkedListing: { select: { id: true } },
    },
    orderBy: { name: "asc" },
    take: 10,
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    salePrice: p.salePrice.toString(),
    currentStock: p.currentStock,
    linked: p.mlLinkedListing !== null,
  }));
}
