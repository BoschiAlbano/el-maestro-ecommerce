// Qué hacer con lo que se leyó de una publicación vinculada (specs/020, plan
// sección 3.5). Se compara siempre contra lo que hay en Mercado Libre ahora,
// no contra lo que dice el aviso: así el aviso de un cambio propio no
// encuentra diferencias y no hace nada. Pura.
import Decimal from "decimal.js";
import type { MlListingStatus } from "@/generated/prisma/enums";
import { publishableQuantity } from "./link-preview";
import type { ListingRead } from "./listing-read";
import { mapListingStatus, statusChangeNote } from "./listing-status";
import { normalizeSku, skuKeyOf } from "./sku";

export type StoredListing = {
  status: MlListingStatus;
  /** Hay un precio del sistema que todavía no llegó a Mercado Libre. */
  pricePending: boolean;
  /** SKU en conflicto ya señalado, para no avisar dos veces lo mismo. */
  skuConflict?: string | null;
  /** Hay una cantidad del sistema que todavía no llegó a Mercado Libre (specs/021). */
  quantityPending?: boolean;
};

export type CurrentProduct = {
  salePrice: string;
  sku: string | null;
  /** Stock del sistema, para la cantidad que corresponde publicar (specs/021). */
  currentStock: number;
};

/**
 * De dónde viene la lectura (specs/021, plan sección 3.3): un aviso de Mercado
 * Libre, o el control completo (diario o «Sincronizar ahora»).
 */
export type ReconcileMode = "notification" | "control";

export type ReconcileInput = {
  stored: StoredListing;
  product: CurrentProduct;
  read: ListingRead;
  /** El SKU que llegó de Mercado Libre ya lo usa otro producto. Lo calcula quien llama. */
  incomingSkuTakenByOther: boolean;
  /** Por defecto, `notification`. */
  mode?: ReconcileMode;
};

export type ReconcileResult = {
  listing: {
    status: MlListingStatus;
    mlStatus: string;
    mlSubStatus: string[];
    statusReason: string | null;
    lastKnownPrice: string;
    lastKnownSku: string | null;
    lastKnownQuantity: number;
    skuConflict: string | null;
    title: string;
    thumbnailUrl: string | null;
    permalink: string;
    categoryId: string | null;
  };
  /** Finalizada: el producto queda libre para otra publicación (RF-17). */
  closed: boolean;
  /** El precio cambió en Mercado Libre: nuevo precio de venta del producto (RF-14). */
  newSalePrice: string | null;
  /** Hay un envío propio pendiente y Mercado Libre todavía muestra otro precio. */
  pushPendingPrice: boolean;
  /** La cantidad en Mercado Libre no es la del sistema y hay que enviarla (specs/021, RF-11). */
  pushQuantity: boolean;
  /** El SKU cambió en Mercado Libre y se toma (RF-3). `sku: null` si lo borraron. */
  newProductSku: { sku: string | null; skuKey: string | null } | null;
  /** Mensaje para la campanita, si corresponde (RF-14). */
  notification: string | null;
};

function money(value: string): string {
  return `$${new Decimal(value).toNumber().toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function sameSku(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return skuKeyOf(a) === skuKeyOf(b);
}

export function reconcile({
  stored,
  product,
  read,
  incomingSkuTakenByOther,
  mode = "notification",
}: ReconcileInput): ReconcileResult {
  const mapped = mapListingStatus(read.mlStatus, read.mlSubStatus);
  const closed = mapped.status === "CLOSED";

  // Precio: un solo precio, manda el último cambio. Con un envío propio
  // pendiente, el del sistema es más nuevo que el que muestra Mercado Libre.
  let newSalePrice: string | null = null;
  let pushPendingPrice = false;
  if (!closed && !new Decimal(read.price).equals(product.salePrice)) {
    if (stored.pricePending) pushPendingPrice = true;
    else newSalePrice = new Decimal(read.price).toString();
  }

  // Cantidad: manda el sistema (specs/021, RF-11). Si Mercado Libre tiene de
  // menos y la lectura viene de un aviso, puede ser una venta de Mercado Libre
  // que el sistema todavía no registró (spec 022): no se sube en el momento,
  // lo corrige el control completo. Un envío propio pendiente siempre se manda.
  const expectedQuantity = publishableQuantity(product.currentStock);
  let pushQuantity = false;
  if (!closed && read.quantity !== expectedQuantity) {
    pushQuantity = Boolean(stored.quantityPending) || read.quantity > expectedQuantity || mode === "control";
  }

  // SKU: se toma el de Mercado Libre salvo que no sea válido o sea de otro producto.
  let newProductSku: ReconcileResult["newProductSku"] = null;
  let skuConflict: string | null = null;
  if (!closed && !sameSku(read.sku, product.sku)) {
    if (read.sku === null) {
      newProductSku = { sku: null, skuKey: null };
    } else {
      const normalized = normalizeSku(read.sku);
      if (!normalized.ok || incomingSkuTakenByOther) skuConflict = read.sku;
      else newProductSku = { sku: normalized.sku, skuKey: normalized.skuKey };
    }
  }

  // Todo cambio que llega de Mercado Libre avisa, en una sola frase por
  // publicación (RF-14, cambio 2026-11-16). Un cambio propio no llega acá
  // con diferencias, así que no avisa.
  const notes: string[] = [];
  const statusNote = statusChangeNote(stored.status, mapped);
  if (statusNote) notes.push(statusNote);
  if (newSalePrice !== null) {
    notes.push(
      `El precio cambió en Mercado Libre de ${money(product.salePrice)} a ${money(newSalePrice)}: es el nuevo precio de venta.`,
    );
  }
  if (newProductSku !== null) {
    notes.push(
      newProductSku.sku === null
        ? `Se borró el SKU en Mercado Libre: el producto quedó sin SKU (tenía ${product.sku}).`
        : `El SKU cambió en Mercado Libre de ${product.sku ?? "ninguno"} a ${newProductSku.sku}.`,
    );
  }
  if (skuConflict !== null && skuConflict !== (stored.skuConflict ?? null)) {
    notes.push(`El SKU cambió en Mercado Libre a ${skuConflict}, pero no se tomó: es de otro producto o no es válido.`);
  }
  const notification = notes.length > 0 ? `«${read.title}»: ${notes.join(" ")}` : null;

  return {
    listing: {
      status: mapped.status,
      mlStatus: read.mlStatus,
      mlSubStatus: read.mlSubStatus,
      statusReason: mapped.reason,
      lastKnownPrice: read.price,
      lastKnownSku: read.sku,
      lastKnownQuantity: read.quantity,
      skuConflict,
      title: read.title,
      thumbnailUrl: read.thumbnailUrl,
      permalink: read.permalink,
      categoryId: read.categoryId,
    },
    closed,
    newSalePrice,
    pushPendingPrice,
    pushQuantity,
    newProductSku,
    notification,
  };
}
