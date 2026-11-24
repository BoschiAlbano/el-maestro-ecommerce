import { describe, expect, it } from "vitest";
import prices from "./__fixtures__/listing-prices-cable-7500.json";
import { estimate, type MlListingPrice } from "./estimate";
import { causesOf, classifyCauses } from "./ml-validation";

// Respuestas reales de `/items/validate` en la prueba técnica (2026-11-24).
const withoutBrand = {
  cause: [
    { department: "structured-data", cause_id: 3704, type: "warning", code: "item.attribute.missing_catalog_required", message: 'El campo "Marca" es obligatorio y no está cargado.' },
    {
      department: "items",
      cause_id: 147,
      type: "error",
      code: "item.attributes.missing_required",
      message: "The attributes [BRAND] are required for category MLA5338 and channel marketplace. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes.",
    },
    { department: "shipping", cause_id: 4053, type: "warning", code: "shipping.lost_me1_by_user", message: "User has not mode me1" },
    { department: "shipping", cause_id: 4033, type: "warning", code: "shipping.free_shipping.cost_exceeded", message: "Free shipping costs exceeds sale" },
  ],
  message: "Validation error",
  error: "validation_error",
  status: 400,
};

describe("classifyCauses (specs/025, RF-6 y RF-8)", () => {
  it("la marca faltante: un solo error, con el nombre del formulario", () => {
    const result = classifyCauses(causesOf(withoutBrand), { BRAND: "Marca del cable" });
    expect(result.errors).toEqual(["Faltan características obligatorias: «Marca del cable»."]);
  });

  it("solo advertencias: no frena, y la de `me1` no se muestra", () => {
    const onlyWarnings = { cause: withoutBrand.cause.slice(2) };
    expect(classifyCauses(causesOf(onlyWarnings))).toEqual({
      errors: [],
      warnings: ["El envío gratis le costaría al vendedor más que el precio de venta. Revisá el precio o las medidas del paquete."],
    });
  });

  it("un mensaje en español se usa tal cual; uno en inglés desconocido lleva su código", () => {
    const result = classifyCauses([
      { type: "error", code: "item.x", message: "La foto es muy chica." },
      { type: "error", code: "item.y.invalid", message: "Something went wrong" },
    ]);
    expect(result.errors).toEqual(["La foto es muy chica.", "Mercado Libre: Something went wrong (item.y.invalid)"]);
  });

  it("el envío gratis obligatorio se explica en español (T-008)", () => {
    expect(
      classifyCauses([{ type: "warning", code: "item.shipping.mandatory_free_shipping", message: "Mandatory free shipping added" }]).warnings,
    ).toEqual(["Por el precio, Mercado Libre agrega envío gratis: lo que te cuesta figura en la estimación."]);
  });

  it("una respuesta sin causas usa su mensaje", () => {
    expect(causesOf({ message: "seller has no permission" })).toEqual([{ type: "error", message: "seller has no permission" }]);
    expect(causesOf(null)).toEqual([]);
  });
});

describe("estimate (RF-4), con los precios reales del cable a $7.500", () => {
  const rows = prices as MlListingPrice[];

  it("Clásica: 15,5 % más el cargo fijo", () => {
    expect(estimate({ price: "7500", listingType: "gold_special", prices: rows, shippingCost: 0, purchasePrice: null })).toEqual({
      price: "7500.00",
      fee: "2492.50",
      percentage: 15.5,
      fixedFee: "1330.00",
      shippingCost: "0.00",
      net: "5007.50",
      margin: null,
    });
  });

  it("Premium cobra más por las cuotas sin interés", () => {
    const premium = estimate({ price: "7500", listingType: "gold_pro", prices: rows, shippingCost: 0, purchasePrice: null });
    expect(premium?.fee).toBe("3460.00");
    expect(premium?.percentage).toBe(28.4);
  });

  it("con envío gratis a cargo del vendedor y el permiso de costos", () => {
    const result = estimate({ price: "7500", listingType: "gold_special", prices: rows, shippingCost: 1200, purchasePrice: "3000" });
    expect(result?.net).toBe("3807.50");
    expect(result?.margin).toEqual({ purchasePrice: "3000.00", amount: "807.50" });
  });

  it("sin el tipo en la respuesta de Mercado Libre, no hay estimación", () => {
    expect(estimate({ price: "7500", listingType: "gold_pro", prices: [], shippingCost: 0, purchasePrice: null })).toBeNull();
  });
});
