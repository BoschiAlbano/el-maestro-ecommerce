import { describe, expect, it } from "vitest";
import { buildUpdateBody } from "./update-body";

describe("buildUpdateBody", () => {
  it("sin variante, todo va en la publicación", () => {
    expect(buildUpdateBody({ price: "15000.50", quantity: 3, sku: "ABC-1", status: "paused" })).toEqual({
      price: 15000.5,
      available_quantity: 3,
      attributes: [{ id: "SELLER_SKU", value_name: "ABC-1" }],
      status: "paused",
    });
  });

  it("con una variante, precio, cantidad y SKU van en ella (prueba con la cuenta de prueba)", () => {
    expect(buildUpdateBody({ price: "2500", quantity: 1, sku: "BIL-BLB-M902-NEG" }, "208633027325")).toEqual({
      variations: [
        {
          id: 208633027325,
          price: 2500,
          available_quantity: 1,
          attributes: [{ id: "SELLER_SKU", value_name: "BIL-BLB-M902-NEG" }],
        },
      ],
    });
  });

  it("con una variante, el estado va en la publicación", () => {
    expect(buildUpdateBody({ status: "active" }, "208633027325")).toEqual({ status: "active" });
    expect(buildUpdateBody({ quantity: 0, status: "paused" }, "208633027325")).toEqual({
      variations: [{ id: 208633027325, available_quantity: 0 }],
      status: "paused",
    });
  });
});
