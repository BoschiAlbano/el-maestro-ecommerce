/**
 * Validación de filas de la planilla de importación (specs/004, sección 4).
 * Lógica pura acá (sin tocar la base) — resolver nombres de marca/rubro
 * contra la base y generar códigos de barras es trabajo de la Server
 * Action que la usa (`src/app/(app)/productos/importar/actions.ts`).
 */

export const IMPORT_COLUMNS = [
  "Nombre",
  "Marca",
  "Rubro",
  "Subrubro",
  "Código de barras",
  "Precio de compra",
  "Precio de venta",
  "Stock mínimo",
] as const;

export type ParsedProductRow = {
  name: string;
  brandName?: string;
  rubroName: string;
  subrubroName?: string;
  barcode?: string;
  purchasePrice: number;
  salePrice: number;
  minStock?: number;
};

export type RowValidationResult =
  | { rowNumber: number; status: "valid"; data: ParsedProductRow }
  | { rowNumber: number; status: "invalid"; errors: string[] };

function cell(row: Record<string, unknown>, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Admite formato ARS ("1.234,56") y el simple ("1234.56" o "1234"). */
function parseMoney(raw: string): number | null {
  if (!raw) return null;
  let normalized = raw.trim();
  if (normalized.includes(",")) {
    // Hay coma: los puntos (si hay) son separador de miles, la coma es el decimal.
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Valida el formato de cada fila (sin tocar la base). Fila 1 = primera fila de datos. */
export function validateImportRows(rawRows: Record<string, unknown>[]): RowValidationResult[] {
  return rawRows.map((raw, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];

    const name = cell(raw, "Nombre");
    if (!name) errors.push("Falta el nombre.");

    const rubroName = cell(raw, "Rubro");
    if (!rubroName) errors.push("Falta el rubro.");

    const brandName = cell(raw, "Marca") || undefined;
    const subrubroName = cell(raw, "Subrubro") || undefined;
    const barcode = cell(raw, "Código de barras") || undefined;
    if (barcode && !/^\d+$/.test(barcode)) {
      errors.push("El código de barras solo puede tener números.");
    }

    const purchasePriceRaw = cell(raw, "Precio de compra");
    const purchasePrice = parseMoney(purchasePriceRaw);
    if (purchasePrice === null) errors.push("Precio de compra inválido.");

    const salePriceRaw = cell(raw, "Precio de venta");
    const salePrice = parseMoney(salePriceRaw);
    if (salePrice === null) errors.push("Precio de venta inválido.");

    const minStockRaw = cell(raw, "Stock mínimo");
    let minStock: number | undefined;
    if (minStockRaw) {
      const parsed = Number(minStockRaw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.push("Stock mínimo tiene que ser un número entero, 0 o más.");
      } else {
        minStock = parsed;
      }
    }

    if (errors.length > 0) {
      return { rowNumber, status: "invalid", errors };
    }

    return {
      rowNumber,
      status: "valid",
      data: {
        name,
        brandName,
        rubroName,
        subrubroName,
        barcode,
        purchasePrice: purchasePrice!,
        salePrice: salePrice!,
        minStock,
      },
    };
  });
}
