import { describe, expect, it } from "vitest";
import paid from "./__fixtures__/orden-pagada.json";
import cancelled from "./__fixtures__/orden-cancelada.json";
import cart1 from "./__fixtures__/carrito-orden-1.json";
import cart2 from "./__fixtures__/carrito-orden-2.json";
import { mlOrderSchema, readOrder } from "./order-read";
import { buildMlSale, describePurchase, isBeforeStart, isPartiallyCancelled, isPurchaseCancelled, isPurchasePaid } from "./order-sale";

const read = (o: unknown) => readOrder(mlOrderSchema.parse(o));
const order = read(paid);
const cart = [read(cart1), read(cart2)];

describe("buildMlSale", () => {
  it("una orden: total, lo que cobra Mercado Libre y neto", () => {
    const sale = buildMlSale([order], new Map([["MLA2304418309", "p-billetera"]]));
    expect(sale).toMatchObject({ total: "2500", mlFee: "1730", sellerShippingCost: "0", net: "770", needsReview: null });
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({ productId: "p-billetera", quantity: 1, unitPrice: "2500" });
  });

  it("el carrito de la prueba técnica es una sola venta con los dos productos", () => {
    const links = new Map([
      ["MLA2304418309", "p-billetera"],
      ["MLA2304611029", "p-cable"],
    ]);
    const sale = buildMlSale(cart, links);
    expect(sale.total).toBe("7500");
    expect(sale.mlFee).toBe("3835");
    expect(sale.items.map((i) => i.productId).sort()).toEqual(["p-billetera", "p-cable"]);
    expect(new Set(sale.items.map((i) => i.mlOrderId)).size).toBe(2);
  });

  it("lo que cobra Mercado Libre es por unidad", () => {
    const two = read({ ...paid, order_items: [{ ...paid.order_items[0], quantity: 2 }] });
    expect(buildMlSale([two], new Map()).mlFee).toBe("3460");
  });

  it("descuenta el envío a cargo del vendedor", () => {
    expect(buildMlSale([order], new Map(), "500").net).toBe("270");
  });

  it("un ítem sin vincular no tiene producto y marca la orden para revisar", () => {
    const sale = buildMlSale(cart, new Map([["MLA2304418309", "p-billetera"]]));
    expect(sale.items.find((i) => i.mlItemId === "MLA2304611029")?.productId).toBeNull();
    expect(sale.needsReview).toMatch(/Un producto de una publicación sin vincular/);
    expect(sale.total).toBe("7500");
  });
});

describe("estado de la compra", () => {
  it("pagada solo si todas las órdenes del paquete lo están", () => {
    expect(isPurchasePaid(cart)).toBe(true);
    expect(isPurchasePaid([cart[0], { ...cart[1], paid: false }])).toBe(false);
    expect(isPurchasePaid([])).toBe(false);
  });

  it("cancelada entera o en parte", () => {
    const c = read(cancelled);
    expect(isPurchaseCancelled([c])).toBe(true);
    expect(isPurchaseCancelled([c, order])).toBe(false);
    expect(isPartiallyCancelled([c, order])).toBe(true);
    expect(isPartiallyCancelled([order])).toBe(false);
  });

  it("antes de la fecha de inicio, o sin fecha, no se registra (RF-9b)", () => {
    expect(isBeforeStart(order.createdAt, null)).toBe(true);
    expect(isBeforeStart(order.createdAt, new Date("2026-11-20T00:00:00Z"))).toBe(true);
    expect(isBeforeStart(order.createdAt, new Date("2026-11-19T00:00:00Z"))).toBe(false);
  });
});

describe("describePurchase", () => {
  it("con un producto lo nombra; con varios, los cuenta", () => {
    expect(describePurchase("2000019669122600", [{ title: "Billetera", quantity: 1 }])).toBe("#2000019669122600 (1 × Billetera)");
    expect(
      describePurchase("2000016160983971", [
        { title: "Billetera", quantity: 1 },
        { title: "Cable", quantity: 1 },
      ]),
    ).toBe("#2000016160983971 (2 productos)");
  });
});
