// Estado de una compra de Mercado Libre y qué hacer cuando se cancela
// (specs/022, plan secciones 3.3 y 3.4). Pura.
import type { MlOrderStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABELS: Record<MlOrderStatus, string> = {
  TO_PREPARE: "Para preparar",
  READY_TO_SHIP: "Lista para despachar",
  SHIPPED: "En camino",
  DELIVERED: "Entregada",
  NOT_DELIVERED: "No entregada",
  CANCELLED: "Cancelada",
};

/** Estados en los que la orden todavía no salió del local. */
export const NOT_YET_SHIPPED: MlOrderStatus[] = ["TO_PREPARE", "READY_TO_SHIP"];

export function mapOrderStatus(input: {
  cancelled: boolean;
  shipmentStatus: string | null;
  shipmentSubstatus: string | null;
  /**
   * Retiro en el local (spec 022, RF-20b): no hay envío, así que la entrega la
   * dice la orden. `null` si la compra va por Mercado Envíos.
   */
  pickup?: { delivered: boolean } | null;
}): MlOrderStatus {
  if (input.cancelled) return "CANCELLED";
  if (input.pickup) return input.pickup.delivered ? "DELIVERED" : "TO_PREPARE";
  switch (input.shipmentStatus) {
    case "delivered":
      return "DELIVERED";
    case "not_delivered":
      return "NOT_DELIVERED";
    case "shipped":
      return "SHIPPED";
    // Un envío cancelado solo no cancela la compra: la cancelación la decide la
    // orden (`cancelled`), que puede llegar un momento después (verificación
    // de la spec 024). Quien llama conserva el estado que tenía.
    case "ready_to_ship":
      return input.shipmentSubstatus === "printed" ? "READY_TO_SHIP" : "TO_PREPARE";
    default:
      return "TO_PREPARE";
  }
}

/**
 * Qué pasa con el stock cuando una compra registrada se cancela (RF-19, RF-20).
 * Antes de despachar se devuelve; después, la mercadería todavía no volvió y se
 * reingresa a mano.
 */
export function cancellationEffect(input: { shippedAt: Date | null; previousStatus: MlOrderStatus }): "return_stock" | "keep_stock" {
  if (input.shippedAt !== null) return "keep_stock";
  return AFTER_SHIPPING.includes(input.previousStatus) ? "keep_stock" : "return_stock";
}

/** Estados en los que la mercadería ya salió del local. */
const AFTER_SHIPPING: MlOrderStatus[] = ["SHIPPED", "DELIVERED", "NOT_DELIVERED"];

/**
 * Fechas que se guardan al pasar de estado. Si Mercado Libre informa la entrega
 * sin haber avisado antes el despacho, la orden igual queda como despachada:
 * quien llama conserva la fecha de despacho que ya tenía.
 */
export function statusTimestamps(next: MlOrderStatus, now: Date): { shippedAt?: Date; deliveredAt?: Date } {
  if (next === "SHIPPED" || next === "NOT_DELIVERED") return { shippedAt: now };
  if (next === "DELIVERED") return { shippedAt: now, deliveredAt: now };
  return {};
}

/**
 * Si la compra es con retiro en el local y si ya se entregó (spec 022,
 * RF-20b). Un paquete es de retiro si ninguna orden tiene envío; se da por
 * entregado cuando todas sus órdenes lo dicen.
 */
export function purchasePickup(
  orders: readonly { localPickUp: boolean; deliveredByOrder: boolean; shipmentId: string | null }[],
): { delivered: boolean } | null {
  if (orders.length === 0 || orders.some((o) => o.shipmentId) || !orders.some((o) => o.localPickUp)) return null;
  return { delivered: orders.every((o) => o.deliveredByOrder) };
}
