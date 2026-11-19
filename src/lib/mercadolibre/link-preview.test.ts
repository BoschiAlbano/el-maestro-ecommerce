import { describe, expect, it } from "vitest";
import { buildLinkPreview, publishableQuantity } from "./link-preview";

describe("buildLinkPreview", () => {
  it("manda el sistema: precio, cantidad y SKU del producto", () => {
    const preview = buildLinkPreview(
      { salePrice: "15000.00", currentStock: 3, sku: "ABC-1" },
      { price: "777777", quantity: 5, sku: "ODOO-TEST-001" },
    );
    expect(preview).toEqual({
      price: { from: "777777", to: "15000", changes: true },
      quantity: { from: 5, to: 3, changes: true },
      sku: { from: "ODOO-TEST-001", to: "ABC-1", changes: true },
      productTakesListingSku: false,
    });
  });

  it("si todo coincide, no cambia nada (el precio se compara como número)", () => {
    const preview = buildLinkPreview(
      { salePrice: "777777.00", currentStock: 5, sku: "ODOO-TEST-001" },
      { price: "777777", quantity: 5, sku: "ODOO-TEST-001" },
    );
    expect([preview.price.changes, preview.quantity.changes, preview.sku.changes]).toEqual([false, false, false]);
  });

  it("producto sin SKU toma el de la publicación", () => {
    const preview = buildLinkPreview(
      { salePrice: "100", currentStock: 1, sku: null },
      { price: "100", quantity: 1, sku: "ODOO-TEST-001" },
    );
    expect(preview.sku).toEqual({ from: "ODOO-TEST-001", to: "ODOO-TEST-001", changes: false });
    expect(preview.productTakesListingSku).toBe(true);
  });

  it("ninguno tiene SKU", () => {
    const preview = buildLinkPreview({ salePrice: "100", currentStock: 1, sku: null }, { price: "100", quantity: 1, sku: null });
    expect(preview.sku).toEqual({ from: null, to: null, changes: false });
    expect(preview.productTakesListingSku).toBe(false);
  });

  it("stock negativo publica 0", () => {
    const preview = buildLinkPreview({ salePrice: "100", currentStock: -2, sku: null }, { price: "100", quantity: 4, sku: null });
    expect(preview.quantity).toEqual({ from: 4, to: 0, changes: true });
  });

  it("descuenta la reserva", () => {
    const preview = buildLinkPreview({ salePrice: "100", currentStock: 10, sku: null }, { price: "100", quantity: 10, sku: null }, 3);
    expect(preview.quantity.to).toBe(7);
  });
});

describe("publishableQuantity", () => {
  it.each([
    [10, 0, 10],
    [10, 3, 7],
    [2, 3, 0],
    [-5, 0, 0],
  ])("stock %i, reserva %i → %i", (stock, reserve, expected) => {
    expect(publishableQuantity(stock, reserve)).toBe(expected);
  });
});
