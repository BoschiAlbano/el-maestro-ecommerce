"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission, requireSpecialPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { generateUniqueBarcode } from "@/lib/barcode";
import { uploadProductPhoto } from "@/lib/upload-photo";
import { registerStockMovement } from "@/lib/stock";
import { normalizeOptionalSku } from "@/lib/mercadolibre/sku";
import { updateListing } from "@/lib/mercadolibre/listings-api";
import {
  markPausePending,
  markPricePending,
  mlErrorMessage,
  scheduleListingPush,
} from "@/lib/mercadolibre/listings";

export type ActionState = { error?: string; warning?: string };

const SKU_TAKEN = "Ya hay otro producto con ese SKU.";

/** La base rechazó un SKU repetido (dos personas guardando a la vez). */
function isSkuCollision(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  return JSON.stringify((error as { meta?: unknown }).meta ?? {}).includes("skuKey");
}

function readSku(formData: FormData) {
  const raw = formData.get("sku");
  return normalizeOptionalSku(typeof raw === "string" ? raw : null);
}

// Los precios son opcionales en el esquema porque un <input disabled> no
// viaja en el FormData: quien no tiene "cambiarPrecios" ve esos campos
// deshabilitados (product-form.tsx) y simplemente no los manda. Si fueran
// obligatorios, z.coerce.number() convertiría el `null` ausente en 0, y
// updateProduct creería (equivocadamente) que intentaron poner el precio en
// cero. createProduct exige el permiso especial antes de llegar a parsear,
// así que ahí siempre están presentes igual.
const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  brandId: z.string().optional(),
  rubroId: z.string().min(1, "Elegí un rubro."),
  barcode: z.string().trim().optional(),
  purchasePrice: z.coerce.number().min(0, "El precio de compra no puede ser negativo.").optional(),
  salePrice: z.coerce.number().min(0, "El precio de venta no puede ser negativo.").optional(),
  minStock: z.coerce.number().int().min(0, "No puede ser negativo.").optional(),
  // Solo en el alta (specs/005): atajo para no tener que hacer un conteo
  // físico aparte apenas se crea un producto con stock ya conocido.
  initialStock: z.coerce.number().int().min(0, "No puede ser negativo.").optional(),
});

/** `undefined` si no se eligió archivo (el input queda con un `File` vacío). */
async function getUploadedPhotoUrl(formData: FormData): Promise<string | undefined> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return undefined;
  return uploadProductPhoto(file);
}

function parseProductForm(formData: FormData) {
  const brandIdRaw = formData.get("brandId");
  const brandId = brandIdRaw && brandIdRaw !== "__none__" ? brandIdRaw : undefined;

  // Sentinelas del formulario (nunca un id real, que siempre es un uuid):
  // "sin elegir todavía" o "crear nuevo" no traducidos a un id real no
  // tienen que llegar a Prisma como si lo fueran.
  const rubroIdRaw = formData.get("rubroId");
  const rubroId =
    typeof rubroIdRaw === "string" && rubroIdRaw.startsWith("__") ? "" : rubroIdRaw;

  return productSchema.safeParse({
    name: formData.get("name"),
    brandId,
    rubroId,
    barcode: formData.get("barcode") || undefined,
    purchasePrice: formData.get("purchasePrice") ?? undefined,
    salePrice: formData.get("salePrice") ?? undefined,
    minStock: formData.get("minStock") || undefined,
    initialStock: formData.get("initialStock") || undefined,
  });
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "crear");
  // Crear un producto implica fijar su precio inicial — mismo permiso que cambiarlo después.
  requireSpecialPermission(currentUser, "cambiarPrecios");

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { name, brandId, rubroId, barcode, purchasePrice, salePrice, minStock, initialStock } =
    parsed.data;
  // El permiso ya exigido garantiza que el formulario de creación no deshabilitó
  // estos campos; si de todas formas faltan, es un dato inválido de verdad.
  if (purchasePrice === undefined || salePrice === undefined) {
    return { error: "Faltan los precios." };
  }
  // El campo de stock inicial se deshabilita en el formulario sin el permiso
  // especial "ajustar stock" (specs/005) — mismo criterio que los precios.
  if (initialStock !== undefined && !hasSpecialPermission(currentUser, "ajustarStock")) {
    return { error: "No tenés permiso para cargar stock." };
  }

  const skuResult = readSku(formData);
  if (!skuResult.ok) return { error: skuResult.error };
  if (skuResult.skuKey && (await prisma.product.findUnique({ where: { skuKey: skuResult.skuKey } }))) {
    return { error: SKU_TAKEN };
  }

  let finalBarcode = barcode;
  let barcodeIsGenerated = false;
  if (!finalBarcode) {
    finalBarcode = await generateUniqueBarcode(prisma);
    barcodeIsGenerated = true;
  } else {
    const collision = await prisma.product.findUnique({ where: { barcode: finalBarcode } });
    if (collision) return { error: "Ya existe un producto con ese código de barras." };
  }

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const finalMinStock = minStock ?? settings.stockMinimoDefault;

  let photoUrl: string | undefined;
  try {
    photoUrl = await getUploadedPhotoUrl(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo subir la foto." };
  }

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          brandId: brandId || null,
          rubroId,
          barcode: finalBarcode!,
          barcodeIsGenerated,
          sku: skuResult.sku,
          skuKey: skuResult.skuKey,
          photoUrl,
          purchasePrice,
          salePrice,
          minStock: finalMinStock,
        },
      });
      await tx.productPriceHistory.create({
        data: { productId: created.id, purchasePrice, salePrice, changedByUserId: currentUser.id },
      });
      if (initialStock) {
        await registerStockMovement(tx, {
          productId: created.id,
          type: "AJUSTE",
          quantity: initialStock,
          reason: "Carga inicial al crear el producto",
          userId: currentUser.id,
        });
      }
      return created;
    });
  } catch (error) {
    if (isSkuCollision(error)) return { error: SKU_TAKEN };
    throw error;
  }

  revalidatePath("/productos");
  redirect(`/productos/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "editar");

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) return { error: "El producto no existe." };

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { name, brandId, rubroId, barcode, purchasePrice, salePrice, minStock } = parsed.data;

  if (barcode && barcode !== existing.barcode) {
    const collision = await prisma.product.findUnique({ where: { barcode } });
    if (collision) return { error: "Ya existe un producto con ese código de barras." };
  }

  const skuResult = readSku(formData);
  if (!skuResult.ok) return { error: skuResult.error };
  if (skuResult.skuKey && skuResult.skuKey !== existing.skuKey) {
    const collision = await prisma.product.findUnique({ where: { skuKey: skuResult.skuKey } });
    if (collision) return { error: SKU_TAKEN };
  }
  const skuChanged = skuResult.sku !== existing.sku;
  // Con publicación vigente el SKU se mantiene igual en los dos lados (specs/020, RF-3).
  const listing = skuChanged
    ? await prisma.mercadoLibreListing.findUnique({ where: { linkedProductId: productId } })
    : null;
  if (listing && skuResult.sku === null) {
    return { error: "Este producto está publicado en Mercado Libre: el SKU se puede cambiar, pero no borrar." };
  }

  // Cambiar el precio es un permiso especial aparte de "editar" (specs/004,
  // sección 7): si no lo tiene, se guarda todo lo demás igual, pero el
  // precio queda como estaba. `purchasePrice`/`salePrice` vienen `undefined`
  // cuando el campo estaba deshabilitado (no viajó en el FormData) — eso no
  // es "intentó poner el precio en 0", es que ni lo mandó.
  const priceSubmitted = purchasePrice !== undefined && salePrice !== undefined;
  const priceChanged =
    priceSubmitted &&
    (existing.purchasePrice.toNumber() !== purchasePrice || existing.salePrice.toNumber() !== salePrice);
  const puedeCambiarPrecio = hasSpecialPermission(currentUser, "cambiarPrecios");
  const aplicarCambioPrecio = priceChanged && puedeCambiarPrecio;

  const finalPurchasePrice = aplicarCambioPrecio ? purchasePrice : existing.purchasePrice;
  const finalSalePrice = aplicarCambioPrecio ? salePrice : existing.salePrice;

  let photoUrl: string | undefined;
  try {
    photoUrl = await getUploadedPhotoUrl(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo subir la foto." };
  }

  // Primero Mercado Libre: si no responde, no se guarda nada (specs/020, sección 7).
  if (listing && skuResult.sku !== null) {
    try {
      await updateListing(listing.mlItemId, { sku: skuResult.sku });
    } catch (error) {
      return { error: `No se guardó ningún cambio. ${mlErrorMessage(error)}` };
    }
  }

  const salePriceChanged = aplicarCambioPrecio && !existing.salePrice.equals(finalSalePrice);
  let pricePending = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          name,
          brandId: brandId || null,
          rubroId,
          barcode: barcode || existing.barcode,
          sku: skuResult.sku,
          skuKey: skuResult.skuKey,
          photoUrl: photoUrl ?? existing.photoUrl,
          purchasePrice: finalPurchasePrice,
          salePrice: finalSalePrice,
          minStock: minStock ?? existing.minStock,
        },
      });
      if (aplicarCambioPrecio) {
        await tx.productPriceHistory.create({
          data: {
            productId,
            purchasePrice: finalPurchasePrice,
            salePrice: finalSalePrice,
            changedByUserId: currentUser.id,
          },
        });
      }
      if (listing && skuResult.sku !== null) {
        await tx.mercadoLibreListing.update({
          where: { id: listing.id },
          data: { lastKnownSku: skuResult.sku, skuConflict: null },
        });
      }
      // Un solo precio: el cambio se envía a Mercado Libre sin esperarlo (RF-13).
      if (salePriceChanged) pricePending = await markPricePending(tx, [productId]);
    });
  } catch (error) {
    if (isSkuCollision(error)) return { error: SKU_TAKEN };
    throw error;
  }
  if (pricePending > 0) scheduleListingPush([productId]);

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);

  if (priceChanged && !puedeCambiarPrecio) {
    return { warning: "Se guardaron los demás cambios, pero no tenés permiso para cambiar el precio." };
  }

  redirect("/productos");
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionState> {
  const currentUser = await getCurrentUser();
  requirePermission(currentUser, ModuloNegocio.CATALOGO, "anular");

  // Desactivar el producto pausa su publicación (specs/020, RF-18); reactivarlo no la reactiva.
  const pausePending = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { active } });
    return active ? 0 : markPausePending(tx, productId);
  });
  if (pausePending > 0) scheduleListingPush([productId]);
  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
  return {};
}
