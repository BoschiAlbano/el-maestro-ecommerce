"use server";

import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { validateImportRows, type ParsedProductRow, type RowValidationResult } from "@/lib/product-import";
import { generateUniqueBarcode } from "@/lib/barcode";

export type PreviewState = { error?: string; rows?: RowValidationResult[] };
export type ConfirmState = { error?: string; created?: number };

async function parseUploadedFile(file: File): Promise<Record<string, unknown>[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  const workbook = new ExcelJS.Workbook();
  const sheet = isCsv
    ? await workbook.csv.read(Readable.from([buffer]))
    : await (async () => {
        // `as any`: los tipos de exceljs traen su propia versión de `Buffer`
        // (más vieja), que no coincide estructuralmente con la de
        // @types/node@24 aunque sea la misma clase en runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(buffer as any);
        return workbook.worksheets[0];
      })();
  if (!sheet) throw new Error("No se pudo leer el archivo.");

  const headerValues = sheet.getRow(1).values as unknown[];
  const headers = headerValues.slice(1).map((h) => String(h ?? "").trim());

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i + 1];
    });
    const hasData = Object.values(obj).some((v) => v !== undefined && v !== null && String(v).trim() !== "");
    if (hasData) rows.push(obj);
  });

  return rows;
}

export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "crear");
  requireSpecialPermission(currentUser, "cambiarPrecios");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo." };
  }

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = await parseUploadedFile(file);
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?" };
  }

  if (rawRows.length === 0) {
    return { error: "El archivo no tiene filas de datos." };
  }

  const formatResults = validateImportRows(rawRows);

  // Chequeo de códigos de barras duplicados: contra la base y dentro del mismo archivo.
  const seenBarcodes = new Map<string, number>(); // barcode -> primera fila que lo usa
  const results: RowValidationResult[] = [];
  for (const result of formatResults) {
    if (result.status === "invalid") {
      results.push(result);
      continue;
    }
    const { barcode } = result.data;
    if (barcode) {
      const dupRow = seenBarcodes.get(barcode);
      if (dupRow) {
        results.push({
          rowNumber: result.rowNumber,
          status: "invalid",
          errors: [`El código de barras se repite con la fila ${dupRow}.`],
        });
        continue;
      }
      const existing = await prisma.product.findUnique({ where: { barcode } });
      if (existing) {
        results.push({
          rowNumber: result.rowNumber,
          status: "invalid",
          errors: ["Ya existe un producto con ese código de barras."],
        });
        continue;
      }
      seenBarcodes.set(barcode, result.rowNumber);
    }
    results.push(result);
  }

  return { rows: results };
}

export async function confirmImport(rows: ParsedProductRow[]): Promise<ConfirmState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "crear");
  requireSpecialPermission(currentUser, "cambiarPrecios");

  if (rows.length === 0) return { error: "No hay filas para importar." };

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const brandCache = new Map<string, string>(); // nombre -> id
  const rubroCache = new Map<string, string>(); // "rubro" o "rubro>subrubro" -> id

  let created = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        let brandId: string | null = null;
        if (row.brandName) {
          const cached = brandCache.get(row.brandName);
          if (cached) {
            brandId = cached;
          } else {
            const brand = await tx.brand.upsert({
              where: { name: row.brandName },
              update: {},
              create: { name: row.brandName },
            });
            brandCache.set(row.brandName, brand.id);
            brandId = brand.id;
          }
        }

        const rubroKey = row.subrubroName ? `${row.rubroName}>${row.subrubroName}` : row.rubroName;
        let rubroId = rubroCache.get(rubroKey);
        if (!rubroId) {
          // find-or-create a mano: Postgres no garantiza unicidad con
          // parentId NULL, así que no se puede usar upsert por la clave
          // compuesta para el nivel de arriba (ver riesgo en plan.md, sección 7).
          let topLevel = await tx.rubro.findFirst({
            where: { name: row.rubroName, parentId: null },
          });
          if (!topLevel) {
            topLevel = await tx.rubro.create({ data: { name: row.rubroName, parentId: null } });
          }

          if (row.subrubroName) {
            let sub = await tx.rubro.findUnique({
              where: { name_parentId: { name: row.subrubroName, parentId: topLevel.id } },
            });
            if (!sub) {
              sub = await tx.rubro.create({
                data: { name: row.subrubroName, parentId: topLevel.id },
              });
            }
            rubroId = sub.id;
          } else {
            rubroId = topLevel.id;
          }
          rubroCache.set(rubroKey, rubroId);
        }

        let barcode = row.barcode;
        let barcodeIsGenerated = false;
        if (!barcode) {
          barcode = await generateUniqueBarcode(tx);
          barcodeIsGenerated = true;
        }

        const product = await tx.product.create({
          data: {
            name: row.name,
            brandId,
            rubroId,
            barcode,
            barcodeIsGenerated,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            minStock: row.minStock ?? settings.stockMinimoDefault,
          },
        });
        await tx.productPriceHistory.create({
          data: {
            productId: product.id,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            changedByUserId: currentUser.id,
          },
        });
        created++;
      }
    },
    { timeout: 60_000 },
  );

  revalidatePath("/productos");
  return { created };
}
