import { describe, expect, it } from "vitest";
import { validateImportRows } from "./product-import";

function row(overrides: Record<string, unknown> = {}) {
  return {
    Nombre: "Auricular XYZ",
    Marca: "Genérica",
    Rubro: "Electrónica",
    Subrubro: "Audio",
    "Código de barras": "",
    "Precio de compra": "1000",
    "Precio de venta": "1500",
    "Stock mínimo": "",
    ...overrides,
  };
}

describe("validateImportRows", () => {
  it("una fila completa y válida pasa", () => {
    const [result] = validateImportRows([row()]);
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.data).toMatchObject({
        name: "Auricular XYZ",
        brandName: "Genérica",
        rubroName: "Electrónica",
        subrubroName: "Audio",
        purchasePrice: 1000,
        salePrice: 1500,
      });
    }
  });

  it("marca, subrubro, código y stock mínimo son opcionales", () => {
    const [result] = validateImportRows([
      row({ Marca: "", Subrubro: "", "Código de barras": "", "Stock mínimo": "" }),
    ]);
    expect(result.status).toBe("valid");
  });

  it("falla si falta el nombre o el rubro", () => {
    const [sinNombre] = validateImportRows([row({ Nombre: "" })]);
    expect(sinNombre.status).toBe("invalid");
    if (sinNombre.status === "invalid") expect(sinNombre.errors).toContain("Falta el nombre.");

    const [sinRubro] = validateImportRows([row({ Rubro: "" })]);
    expect(sinRubro.status).toBe("invalid");
    if (sinRubro.status === "invalid") expect(sinRubro.errors).toContain("Falta el rubro.");
  });

  it("falla con un precio inválido o negativo", () => {
    const [invalido] = validateImportRows([row({ "Precio de compra": "no-es-un-numero" })]);
    expect(invalido.status).toBe("invalid");

    const [negativo] = validateImportRows([row({ "Precio de venta": "-50" })]);
    expect(negativo.status).toBe("invalid");
  });

  it("acepta precios en formato ARS con separador de miles y coma decimal", () => {
    const [result] = validateImportRows([
      row({ "Precio de compra": "1.234,50", "Precio de venta": "2000" }),
    ]);
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.data.purchasePrice).toBe(1234.5);
      expect(result.data.salePrice).toBe(2000);
    }
  });

  it("falla si el código de barras tiene letras", () => {
    const [result] = validateImportRows([row({ "Código de barras": "ABC123" })]);
    expect(result.status).toBe("invalid");
  });

  it("falla si el stock mínimo no es un entero válido", () => {
    const [result] = validateImportRows([row({ "Stock mínimo": "-1" })]);
    expect(result.status).toBe("invalid");

    const [result2] = validateImportRows([row({ "Stock mínimo": "3.5" })]);
    expect(result2.status).toBe("invalid");
  });

  it("numera las filas desde 1 y valida varias filas mezcladas", () => {
    const results = validateImportRows([row(), row({ Nombre: "" }), row()]);
    expect(results.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
    expect(results.map((r) => r.status)).toEqual(["valid", "invalid", "valid"]);
  });
});
