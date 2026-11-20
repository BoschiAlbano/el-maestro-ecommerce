import { describe, expect, it } from "vitest";
import paid from "./__fixtures__/orden-pagada.json";
import cancelled from "./__fixtures__/orden-cancelada.json";
import shipment from "./__fixtures__/envio.json";
import cart1 from "./__fixtures__/carrito-orden-1.json";
import cart2 from "./__fixtures__/carrito-orden-2.json";
import pack from "./__fixtures__/carrito-paquete.json";
import {
  cancelReasonText,
  idFromResource,
  mlOrderSchema,
  mlPackSchema,
  mlShipmentSchema,
  purchaseKey,
  readOrder,
  readShipment,
} from "./order-read";

describe("readOrder", () => {
  it("la compra pagada de la prueba técnica", () => {
    const read = readOrder(mlOrderSchema.parse(paid));
    expect(read).toMatchObject({
      mlOrderId: "2000019667675372",
      packId: null,
      paid: true,
      cancelled: false,
      fraudRisk: false,
      buyerNickname: "TESTUSER1090254404",
      shipmentId: "48579990710",
      total: "2500",
      cancelReason: null,
    });
    expect(read.items).toEqual([
      {
        mlOrderId: "2000019667675372",
        mlItemId: "MLA2304418309",
        mlVariationId: "208633027325",
        sku: "BIL-BLB-M902-NEG",
        title: "Billetera Negra Para Hombre Diseño Clásico",
        quantity: 1,
        unitPrice: "2500",
        saleFee: "1730",
      },
    ]);
    expect(read.createdAt.toISOString()).toBe("2026-11-19T22:54:46.000Z");
  });

  it("la cancelada por el vendedor sin stock", () => {
    const read = readOrder(mlOrderSchema.parse(cancelled));
    expect(read).toMatchObject({ paid: false, cancelled: true, cancelReason: "Cancelada por el vendedor: sin stock." });
    expect(read.cancelledAt?.toISOString()).toBe("2026-11-19T23:14:15.000Z");
  });

  it("las dos órdenes del carrito comparten el paquete", () => {
    const a = readOrder(mlOrderSchema.parse(cart1));
    const b = readOrder(mlOrderSchema.parse(cart2));
    expect(a.packId).toBe("2000016160983971");
    expect(b.packId).toBe(a.packId);
    expect(purchaseKey(a)).toBe("pack:2000016160983971");
    expect(purchaseKey(b)).toBe(purchaseKey(a));
    expect(a.shipmentId).toBe(b.shipmentId);
  });

  it("una orden suelta usa su número como llave", () => {
    expect(purchaseKey(readOrder(mlOrderSchema.parse(paid)))).toBe("order:2000019667675372");
  });

  it("detecta el riesgo de fraude por la etiqueta de la orden", () => {
    const read = readOrder(mlOrderSchema.parse({ ...paid, tags: ["paid", "fraud_risk_detected"] }));
    expect(read.fraudRisk).toBe(true);
  });
});

describe("paquete y envío", () => {
  it("el paquete del carrito lista sus dos órdenes y el envío", () => {
    const parsed = mlPackSchema.parse(pack);
    expect(parsed.orders.map((o) => o.id).sort()).toEqual(["2000019668413224", "2000019668418136"]);
    expect(parsed.shipment?.id).toBe("48580331636");
  });

  it("el envío: estado, etiqueta y destino, sin dirección", () => {
    expect(readShipment(mlShipmentSchema.parse(shipment))).toEqual({
      shipmentId: "48579990710",
      status: "ready_to_ship",
      substatus: "ready_to_print",
      hasLabel: true,
      receiverName: "Comprador de Prueba",
      destinationCity: "San Miguel de Tucumán, Tucumán",
    });
  });
});

describe("cancelReasonText", () => {
  it.each([
    [{ requested_by: "buyer", code: "x" }, "Cancelada por el comprador."],
    [{ requested_by: "seller", code: "feedback_out_of_stock" }, "Cancelada por el vendedor: sin stock."],
    [{ requested_by: "fraud", code: "x" }, "Cancelada por Mercado Libre."],
    [null, null],
  ])("%j → %s", (detail, expected) => {
    expect(cancelReasonText(detail)).toBe(expected);
  });
});

describe("idFromResource", () => {
  it("lee el número de la orden y del envío", () => {
    expect(idFromResource("/orders/2000019667675372", "orders")).toBe("2000019667675372");
    expect(idFromResource("/orders/2000019667675372/feedback", "orders")).toBe("2000019667675372");
    expect(idFromResource("/shipments/48579990710", "shipments")).toBe("48579990710");
    expect(idFromResource("/items/MLA1", "orders")).toBeNull();
  });
});
