import { describe, expect, it } from "vitest";
import { cancellationEffect, mapOrderStatus, purchasePickup, statusTimestamps } from "./order-status";

describe("mapOrderStatus (plan, sección 3.3)", () => {
  it.each([
    [{ cancelled: true, shipmentStatus: "ready_to_ship", shipmentSubstatus: "ready_to_print" }, "CANCELLED"],
    [{ cancelled: false, shipmentStatus: "ready_to_ship", shipmentSubstatus: "ready_to_print" }, "TO_PREPARE"],
    [{ cancelled: false, shipmentStatus: "ready_to_ship", shipmentSubstatus: "printed" }, "READY_TO_SHIP"],
    [{ cancelled: false, shipmentStatus: "shipped", shipmentSubstatus: null }, "SHIPPED"],
    [{ cancelled: false, shipmentStatus: "delivered", shipmentSubstatus: null }, "DELIVERED"],
    [{ cancelled: false, shipmentStatus: "not_delivered", shipmentSubstatus: null }, "NOT_DELIVERED"],
    // Un envío cancelado solo no cancela la compra (verificación de la spec 024).
    [{ cancelled: false, shipmentStatus: "cancelled", shipmentSubstatus: null }, "TO_PREPARE"],
    [{ cancelled: false, shipmentStatus: "pending", shipmentSubstatus: null }, "TO_PREPARE"],
    [{ cancelled: false, shipmentStatus: null, shipmentSubstatus: null }, "TO_PREPARE"],
  ])("%j → %s", (input, expected) => {
    expect(mapOrderStatus(input)).toBe(expected);
  });
});

describe("retiro en el local (spec 022, RF-20b)", () => {
  const order = (over: Partial<{ localPickUp: boolean; deliveredByOrder: boolean; shipmentId: string | null }> = {}) => ({
    localPickUp: true,
    deliveredByOrder: false,
    shipmentId: null,
    ...over,
  });

  it("sin envío y sin entregar: para preparar; entregada por la orden: entregada", () => {
    expect(mapOrderStatus({ cancelled: false, shipmentStatus: null, shipmentSubstatus: null, pickup: { delivered: false } })).toBe("TO_PREPARE");
    expect(mapOrderStatus({ cancelled: false, shipmentStatus: null, shipmentSubstatus: null, pickup: { delivered: true } })).toBe("DELIVERED");
  });

  it("cancelada manda sobre la entrega", () => {
    expect(mapOrderStatus({ cancelled: true, shipmentStatus: null, shipmentSubstatus: null, pickup: { delivered: true } })).toBe("CANCELLED");
  });

  it("purchasePickup: retiro si ninguna orden tiene envío", () => {
    expect(purchasePickup([order()])).toEqual({ delivered: false });
    expect(purchasePickup([order({ deliveredByOrder: true })])).toEqual({ delivered: true });
    expect(purchasePickup([order({ shipmentId: "123" })])).toBeNull();
    expect(purchasePickup([order({ localPickUp: false })])).toBeNull();
    expect(purchasePickup([])).toBeNull();
  });

  it("un paquete se da por entregado cuando todas sus órdenes lo dicen", () => {
    expect(purchasePickup([order({ deliveredByOrder: true }), order()])).toEqual({ delivered: false });
    expect(purchasePickup([order({ deliveredByOrder: true }), order({ deliveredByOrder: true })])).toEqual({ delivered: true });
  });
});

describe("cancellationEffect (RF-19, RF-20)", () => {
  it("antes de despachar devuelve el stock", () => {
    expect(cancellationEffect({ shippedAt: null, previousStatus: "TO_PREPARE" })).toBe("return_stock");
    expect(cancellationEffect({ shippedAt: null, previousStatus: "READY_TO_SHIP" })).toBe("return_stock");
  });

  it("una compra que quedó marcada como cancelada sin procesar, y nunca salió, devuelve el stock", () => {
    expect(cancellationEffect({ shippedAt: null, previousStatus: "CANCELLED" })).toBe("return_stock");
  });

  it("después de despachar no lo devuelve", () => {
    expect(cancellationEffect({ shippedAt: new Date(), previousStatus: "SHIPPED" })).toBe("keep_stock");
    expect(cancellationEffect({ shippedAt: null, previousStatus: "NOT_DELIVERED" })).toBe("keep_stock");
  });
});

describe("statusTimestamps", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("despachada y no entregada guardan el despacho; entregada guarda las dos", () => {
    expect(statusTimestamps("SHIPPED", now)).toEqual({ shippedAt: now });
    expect(statusTimestamps("NOT_DELIVERED", now)).toEqual({ shippedAt: now });
    expect(statusTimestamps("DELIVERED", now)).toEqual({ shippedAt: now, deliveredAt: now });
    expect(statusTimestamps("TO_PREPARE", now)).toEqual({});
  });
});
