import { describe, expect, it } from "vitest";
import billetera from "./__fixtures__/attributes-billetera-MLA417712.json";
import cable from "./__fixtures__/attributes-cable-MLA5338.json";
import discovery from "./__fixtures__/domain-discovery-cable.json";
import {
  categoryAsksGtin,
  categoryFields,
  emptyGtinReasons,
  hasValue,
  keepForCategory,
  prefillFromSuggestion,
  type MlCategoryAttribute,
} from "./category-form";

const cableAttrs = cable as MlCategoryAttribute[];
const billeteraAttrs = billetera as MlCategoryAttribute[];

describe("categoryFields (specs/025, RF-2) con las características reales", () => {
  it("cable: obligatorias la marca y los dos conectores, primero y en el orden de Mercado Libre", () => {
    const fields = categoryFields(cableAttrs);
    expect(fields.filter((f) => f.group === "required").map((f) => f.id)).toEqual(["BRAND", "INPUT_CONNECTOR", "OUTPUT_CONNECTOR"]);
    expect(fields.slice(0, 3).every((f) => f.group === "required")).toBe(true);
  });

  it("billetera: marca, modelo, color y género; el género es una lista", () => {
    const fields = categoryFields(billeteraAttrs);
    const required = fields.filter((f) => f.group === "required");
    expect(required.map((f) => f.id)).toEqual(["BRAND", "MODEL", "COLOR", "GENDER"]);
    expect(required.find((f) => f.id === "GENDER")?.type).toBe("list");
  });

  it("IVA e impuesto interno quedan como condicionales", () => {
    const conditional = categoryFields(cableAttrs).filter((f) => f.group === "conditional").map((f) => f.id);
    expect(conditional).toEqual(["VALUE_ADDED_TAX", "IMPORT_DUTY"]);
  });

  it("deja afuera ocultas, de solo lectura y las que arma el sistema", () => {
    const ids = categoryFields(cableAttrs).map((f) => f.id);
    for (const id of ["SELLER_SKU", "GTIN", "EMPTY_GTIN_REASON", "SELLER_PACKAGE_HEIGHT", "PACKAGE_WEIGHT", "APGID", "ITEM_CONDITION", "ANATEL_HOMOLOGATION_LABEL"]) {
      expect(ids).not.toContain(id);
    }
  });

  it("tipos: texto con sugerencias, número con unidad, sí/no", () => {
    const fields = categoryFields(cableAttrs);
    const brand = fields.find((f) => f.id === "BRAND")!;
    expect(brand.type).toBe("text");
    expect(brand.options.length).toBeGreaterThan(0);
    const length = fields.find((f) => f.id === "CABLE_LENGTH")!;
    expect(length.type).toBe("number_unit");
    expect(length.units.map((u) => u.id)).toEqual(["cm", "m"]);
    expect(length.defaultUnit).not.toBeNull();
    expect(fields.find((f) => f.id === "IS_SUITABLE_FOR_VIDEO_TRANSMISSION")?.type).toBe("boolean");
  });
});

describe("código universal (RF-2)", () => {
  it("las dos categorías piden código o motivo, como condicional", () => {
    expect(categoryAsksGtin(cableAttrs)).toEqual({ gtin: true, required: false });
    expect(categoryAsksGtin(billeteraAttrs)).toEqual({ gtin: true, required: false });
  });

  it("los motivos para publicar sin código, con su id", () => {
    expect(emptyGtinReasons(cableAttrs)).toContainEqual({ id: "17055160", name: "El producto no tiene código registrado" });
  });
});

describe("valores cargados", () => {
  it("hasValue: un texto en blanco no cuenta", () => {
    expect(hasValue({ id: "BRAND", valueName: "  " })).toBe(false);
    expect(hasValue({ id: "BRAND", valueName: "Genérico" })).toBe(true);
    expect(hasValue({ id: "GENDER", valueId: "339666" })).toBe(true);
    expect(hasValue(undefined)).toBe(false);
  });

  it("al cambiar de categoría se conservan las que la nueva también tiene", () => {
    const saved = [
      { id: "BRAND", valueName: "Genérico" },
      { id: "INPUT_CONNECTOR", valueName: "USB-C" },
    ];
    expect(keepForCategory(saved, categoryFields(billeteraAttrs))).toEqual([{ id: "BRAND", valueName: "Genérico" }]);
  });

  it("la sugerencia de Mercado Libre completa sin pisar lo cargado", () => {
    const suggested = (discovery as { attributes: { id: string; value_id: string; value_name: string }[] }[])[0].attributes;
    const result = prefillFromSuggestion([{ id: "INPUT_CONNECTOR", valueName: "USB-A" }], suggested);
    expect(result.find((v) => v.id === "INPUT_CONNECTOR")?.valueName).toBe("USB-A");
    expect(result.find((v) => v.id === "OUTPUT_CONNECTOR")?.valueName).toBe("USB-C");
  });
});
