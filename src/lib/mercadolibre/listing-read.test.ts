import { describe, expect, it } from "vitest";
import realItem from "./__fixtures__/item-modelo-nuevo.json";
import oneVariationItem from "./__fixtures__/item-una-variante.json";
import { itemIdFromResource, mlItemSchema, readListing, type MlItem } from "./listing-read";

const base = mlItemSchema.parse(realItem);

function withChanges(changes: Partial<MlItem>): MlItem {
  return { ...base, ...changes };
}

describe("readListing", () => {
  it("lee la publicación del modelo nuevo de la prueba técnica", () => {
    expect(readListing(base)).toEqual({
      mlItemId: "MLA2279211711",
      title: "Cable Usb-c A Usb-a Negro 1 Metro Trenzado Genérica Negro",
      price: "777777",
      mlStatus: "paused",
      mlSubStatus: ["paused_by_seller"],
      quantity: 5,
      permalink: base.permalink,
      thumbnailUrl: "https://http2.mlstatic.com/D_784078-MLA119504121670_112026-O.jpg",
      categoryId: "MLA5338",
      sku: "ODOO-TEST-001",
      gtins: [],
      variationId: null,
      variationCount: 0,
      notLinkableReason: null,
    });
  });

  it("con una sola variante, toma de ella el precio, la cantidad, el SKU y el código (cuenta de prueba, modelo viejo)", () => {
    const read = readListing(mlItemSchema.parse(oneVariationItem));
    expect(read).toMatchObject({
      mlItemId: "MLA2304418309",
      price: "2500",
      quantity: 1,
      sku: "BIL-BLB-M902-NEG",
      gtins: ["2150119432082"],
      variationId: "208633027325",
      variationCount: 1,
      notLinkableReason: null,
    });
  });

  it("con una variante, su precio y cantidad mandan sobre los de la publicación", () => {
    const item = mlItemSchema.parse({
      ...oneVariationItem,
      price: 1,
      available_quantity: 99,
      variations: [{ ...oneVariationItem.variations[0], price: 3000, available_quantity: 7 }],
    });
    expect(readListing(item)).toMatchObject({ price: "3000", quantity: 7 });
  });

  it("sin SELLER_SKU, el SKU es null", () => {
    const item = withChanges({ attributes: base.attributes?.filter((a) => a.id !== "SELLER_SKU") });
    expect(readListing(item).sku).toBeNull();
  });

  it("lee los códigos universales, aunque sean varios", () => {
    const item = withChanges({
      attributes: [{ id: "GTIN", value_name: "7790001,7790002", values: [{ name: "7790001" }, { name: "7790002" }] }],
    });
    expect(readListing(item).gtins).toEqual(["7790001", "7790002"]);
  });

  it("precio con centavos queda como texto exacto", () => {
    expect(readListing(withChanges({ price: 1234.5 })).price).toBe("1234.5");
  });

  it("sin fotos usa la miniatura, siempre con https", () => {
    const item = withChanges({ pictures: [], thumbnail: "http://http2.mlstatic.com/x-I.jpg" });
    expect(readListing(item).thumbnailUrl).toBe("https://http2.mlstatic.com/x-I.jpg");
  });
});

describe("se puede vincular", () => {
  it("con una sola variante, sí", () => {
    expect(readListing(withChanges({ variations: [{ id: "1" }] })).notLinkableReason).toBeNull();
  });

  it("con dos o más variantes, no", () => {
    const read = readListing(withChanges({ variations: [{ id: "1" }, { id: "2" }] }));
    expect(read.notLinkableReason).toContain("2 variantes");
    expect(read.variationId).toBeNull();
    expect(read.variationCount).toBe(2);
  });

  it("de Full, no", () => {
    expect(readListing(withChanges({ shipping: { logistic_type: "fulfillment" } })).notLinkableReason).toContain(
      "Full",
    );
  });

  it("finalizada, no", () => {
    expect(readListing(withChanges({ status: "closed" })).notLinkableReason).toBe("La publicación está finalizada.");
  });
});

describe("itemIdFromResource", () => {
  it.each([
    ["/items/MLA2279211711", "MLA2279211711"],
    ["/items/MLA2279211711/prices", "MLA2279211711"],
    ["/orders/123", null],
    ["/items/", null],
  ])("%s → %s", (resource, expected) => {
    expect(itemIdFromResource(resource)).toBe(expected);
  });
});
