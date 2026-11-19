import { describe, expect, it } from "vitest";
import { proposeLinks, type ProposalListing, type ProposalProduct } from "./link-proposal";

function product(id: string, skuKey: string | null, barcode: string, linked = false): ProposalProduct {
  return { id, skuKey, barcode, linked };
}

function listing(mlItemId: string, sku: string | null, gtins: string[] = []): ProposalListing {
  return { mlItemId, sku, gtins };
}

describe("proposeLinks", () => {
  it("única coincidencia por SKU, sin distinguir mayúsculas", () => {
    const result = proposeLinks([listing("MLA1", "odoo-test-001")], [product("p1", "ODOO-TEST-001", "779")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: "p1", matchedBy: "sku" }]);
  });

  it("SKU de la publicación contra el código de barras de un producto sin SKU", () => {
    const result = proposeLinks([listing("MLA1", "7790001")], [product("p1", null, "7790001")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: "p1", matchedBy: "barcode" }]);
  });

  it("el código de barras no se usa si el producto ya tiene SKU", () => {
    const result = proposeLinks([listing("MLA1", "7790001")], [product("p1", "OTRO", "7790001")]);
    expect(result[0].productId).toBeNull();
  });

  it("código universal contra código de barras", () => {
    const result = proposeLinks([listing("MLA1", null, ["7790001"])], [product("p1", null, "7790001")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: "p1", matchedBy: "gtin" }]);
  });

  it("el mismo producto por SKU y por código universal cuenta como una coincidencia", () => {
    const result = proposeLinks([listing("MLA1", "ABC", ["7790001"])], [product("p1", "ABC", "7790001")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: "p1", matchedBy: "sku" }]);
  });

  it("varias coincidencias: sin propuesta", () => {
    const result = proposeLinks([listing("MLA1", "ABC", ["7790002"])], [product("p1", "ABC", "1"), product("p2", null, "7790002")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: null, reason: "Coincide con 2 productos: elegí uno a mano." }]);
  });

  it("dos publicaciones para el mismo producto: ninguna se propone", () => {
    const result = proposeLinks([listing("MLA1", "ABC"), listing("MLA2", "abc")], [product("p1", "ABC", "1")]);
    expect(result.every((r) => r.productId === null)).toBe(true);
    expect(result[0]).toMatchObject({ reason: expect.stringContaining("Otra publicación") });
  });

  it("producto ya vinculado: sin propuesta", () => {
    const result = proposeLinks([listing("MLA1", "ABC")], [product("p1", "ABC", "1", true)]);
    expect(result[0]).toMatchObject({ productId: null, reason: expect.stringContaining("ya tiene una publicación") });
  });

  it("sin SKU ni código universal: sin coincidencia", () => {
    const result = proposeLinks([listing("MLA1", null)], [product("p1", "ABC", "1")]);
    expect(result).toEqual([{ mlItemId: "MLA1", productId: null, reason: "No coincide con ningún producto." }]);
  });
});
