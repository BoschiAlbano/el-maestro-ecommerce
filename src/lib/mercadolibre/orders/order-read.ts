// Lectura de órdenes, paquetes y envíos de Mercado Libre (specs/022). Valida
// con `zod` solo la parte que usa el sistema. Pura: sin I/O.
import { z } from "zod";

const id = z.union([z.number(), z.string()]).transform(String);

export const mlOrderSchema = z.object({
  id,
  status: z.string(),
  tags: z.array(z.string()).nullable().optional(),
  pack_id: id.nullable().optional(),
  date_created: z.string(),
  total_amount: z.number(),
  buyer: z.object({
    id,
    nickname: z.string().nullable().optional(),
    /** Para pedir los datos fiscales (specs/024). */
    billing_info: z.object({ id: id.nullable().optional() }).nullable().optional(),
  }),
  shipping: z.object({ id: id.nullable().optional() }).nullable().optional(),
  cancel_detail: z
    .object({
      group: z.string().nullable().optional(),
      code: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      requested_by: z.string().nullable().optional(),
      date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  order_items: z.array(
    z.object({
      item: z.object({
        id: z.string(),
        title: z.string(),
        variation_id: id.nullable().optional(),
        seller_sku: z.string().nullable().optional(),
      }),
      quantity: z.number().int(),
      unit_price: z.number(),
      sale_fee: z.number().nullable().optional(),
    }),
  ),
});

export const mlPackSchema = z.object({
  id,
  orders: z.array(z.object({ id })),
  shipment: z.object({ id }).nullable().optional(),
});

export const mlShipmentSchema = z.object({
  id,
  status: z.string(),
  substatus: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  receiver_address: z
    .object({
      receiver_name: z.string().nullable().optional(),
      city: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
      state: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const mlShipmentSlaSchema = z.object({ expected_date: z.string().nullable().optional() });

export const mlShipmentCostsSchema = z.object({
  senders: z.array(z.object({ cost: z.number().nullable().optional() })).nullable().optional(),
});

export type MlOrder = z.infer<typeof mlOrderSchema>;
export type MlPack = z.infer<typeof mlPackSchema>;
export type MlShipment = z.infer<typeof mlShipmentSchema>;

/** Etiquetas con las que Mercado Libre marca una orden con riesgo de fraude (RF-18). */
const FRAUD_TAGS = new Set(["fraud_risk_detected", "fraud_risk"]);

export type OrderItemRead = {
  mlOrderId: string;
  mlItemId: string;
  mlVariationId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  /** En pesos, como texto para pasarlo a `Decimal`. */
  unitPrice: string;
  /** Lo que cobra Mercado Libre por unidad. */
  saleFee: string;
};

export type OrderRead = {
  mlOrderId: string;
  packId: string | null;
  paid: boolean;
  cancelled: boolean;
  fraudRisk: boolean;
  createdAt: Date;
  buyerNickname: string;
  /** Para pedir los datos fiscales del comprador (specs/024). */
  billingInfoId: string | null;
  shipmentId: string | null;
  /** Lo que pagó el comprador por los productos, sin el envío. */
  total: string;
  items: OrderItemRead[];
  cancelReason: string | null;
  cancelledAt: Date | null;
};

/** Motivo de una cancelación, en español (RF-15). */
export function cancelReasonText(detail: MlOrder["cancel_detail"]): string | null {
  if (!detail) return null;
  const who =
    detail.requested_by === "buyer"
      ? "el comprador"
      : detail.requested_by === "seller"
        ? "el vendedor"
        : "Mercado Libre";
  if (detail.code === "feedback_out_of_stock") return `Cancelada por ${who}: sin stock.`;
  return `Cancelada por ${who}.`;
}

export function readOrder(order: MlOrder): OrderRead {
  const tags = order.tags ?? [];
  return {
    mlOrderId: order.id,
    packId: order.pack_id ?? null,
    paid: order.status === "paid",
    cancelled: order.status === "cancelled",
    fraudRisk: tags.some((t) => FRAUD_TAGS.has(t)),
    createdAt: new Date(order.date_created),
    buyerNickname: order.buyer.nickname ?? `Comprador ${order.buyer.id}`,
    billingInfoId: order.buyer.billing_info?.id ?? null,
    shipmentId: order.shipping?.id ?? null,
    total: String(order.total_amount),
    items: order.order_items.map((i) => ({
      mlOrderId: order.id,
      mlItemId: i.item.id,
      mlVariationId: i.item.variation_id ?? null,
      sku: i.item.seller_sku?.trim() || null,
      title: i.item.title,
      quantity: i.quantity,
      unitPrice: String(i.unit_price),
      saleFee: String(i.sale_fee ?? 0),
    })),
    cancelReason: order.status === "cancelled" ? cancelReasonText(order.cancel_detail) : null,
    cancelledAt: order.cancel_detail?.date ? new Date(order.cancel_detail.date) : null,
  };
}

export type ShipmentRead = {
  shipmentId: string;
  status: string;
  substatus: string | null;
  /** Usa Mercado Envíos (`me2`): hay etiqueta (spec, sección 7). */
  hasLabel: boolean;
  receiverName: string | null;
  destinationCity: string | null;
};

export function readShipment(shipment: MlShipment): ShipmentRead {
  const address = shipment.receiver_address;
  const city = [address?.city?.name, address?.state?.name].filter(Boolean).join(", ");
  return {
    shipmentId: shipment.id,
    status: shipment.status,
    substatus: shipment.substatus ?? null,
    hasLabel: shipment.mode === "me2",
    receiverName: address?.receiver_name?.trim() || null,
    destinationCity: city || null,
  };
}

/** `/orders/123` → `123`; `/shipments/456` → `456`. */
export function idFromResource(resource: string, kind: "orders" | "shipments"): string | null {
  const match = new RegExp(`^/${kind}/(\\d+)(?:/|$)`).exec(resource);
  return match ? match[1] : null;
}

/** La llave de la compra: el paquete si es un carrito, si no la orden (plan, sección 1). */
export function purchaseKey(order: Pick<OrderRead, "packId" | "mlOrderId">): string {
  return order.packId ? `pack:${order.packId}` : `order:${order.mlOrderId}`;
}
