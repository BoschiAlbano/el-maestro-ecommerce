import { prisma } from "@/lib/prisma";
import { getListing } from "./listings-api";
import { applyListingRead, pushPendingListings } from "./listings";
import { itemIdFromResource } from "./listing-read";
import { idFromResource } from "./orders/order-read";
import { syncOrder, syncShipment } from "./orders/orders";

// Qué hace el sistema con cada tema de aviso de Mercado Libre (specs/019,
// RF-15). Los temas sin función quedan como "sin acción". Cada spec agrega
// acá la suya: la 020, publicaciones (`items` e `items_prices`); la 021 y la
// 022, stock y órdenes.
//
// Reglas para quien agregue una función:
//   - El aviso solo dice DÓNDE mirar. La función tiene que consultar el
//     recurso a Mercado Libre (con `mlFetch`) y nunca usar el aviso como dato
//     (RF-10).
//   - Tiene que poder ejecutarse dos veces con el mismo aviso sin duplicar
//     nada: hay reintentos, y dos procesamientos pueden cruzarse.
//   - Si Mercado Libre no responde, dejar que el error suba: el aviso queda
//     pendiente para la próxima pasada.

export type NotificationContext = {
  topic: string;
  resource: string;
  mlUserId: string;
};

export type NotificationHandler = (notification: NotificationContext) => Promise<void>;

/**
 * Cambió algo de una publicación (specs/020, plan sección 3.5). El aviso no
 * dice qué: se lee la publicación y se compara con lo guardado. Un cambio de
 * precio hecho en la web puede llegar solo como `items` (prueba técnica).
 */
async function handleItemChanged({ resource }: NotificationContext): Promise<void> {
  const mlItemId = itemIdFromResource(resource);
  if (!mlItemId) return;
  const listing = await prisma.mercadoLibreListing.findUnique({
    where: { mlItemId },
    select: { id: true, linkedProductId: true },
  });
  // Publicación sin vincular o finalizada: el sistema no la administra.
  if (!listing || listing.linkedProductId === null) return;

  const item = await getListing(mlItemId);
  const result = await applyListingRead(mlItemId, item);
  // Hay un precio propio que no llegó, o la cantidad no es la del sistema
  // (specs/021, RF-11): se envía ahora.
  if (result?.pushPendingPrice || result?.pushQuantity) await pushPendingListings({ listingIds: [listing.id] });
}

/** Una compra de Mercado Libre: se registra o se actualiza (specs/022, plan sección 3.2). */
async function handleOrder({ resource }: NotificationContext): Promise<void> {
  const id = idFromResource(resource, "orders");
  if (id) await syncOrder(id);
}

/** El envío de una compra cambió de estado (specs/022, plan sección 3.3). */
async function handleShipment({ resource }: NotificationContext): Promise<void> {
  const id = idFromResource(resource, "shipments");
  if (id) await syncShipment(id);
}

export const notificationHandlers: Record<string, NotificationHandler> = {
  items: handleItemChanged,
  items_prices: handleItemChanged,
  orders_v2: handleOrder,
  shipments: handleShipment,
};
