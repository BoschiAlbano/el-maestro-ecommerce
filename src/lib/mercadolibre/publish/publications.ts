import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { MlApiError, MlUnavailableError } from "../errors";
import { publishableQuantity } from "../link-preview";
import { readListing } from "../listing-read";
import { mapListingStatus } from "../listing-status";
import { markPricePending, mlErrorMessage, scheduleListingPush } from "../listings";
import { requireMlConnection } from "../listings-view";
import { normalizeSku } from "../sku";
import type { MlItem } from "../listing-read";
import { categoryAsksGtin, categoryFields, emptyGtinReasons, type CategoryField } from "./category-form";
import { estimate, type Estimate } from "./estimate";
import { causesOf, classifyCauses } from "./ml-validation";
import { parsePrice, salePriceChange, type PriceChange } from "./price-change";
import { buildCreateBody, buildUpdateBody } from "./publication-body";
import {
  initialPublicationData,
  missingForPublishing,
  publicationDataFromRow,
  type CategoryRules,
  type MissingItem,
  type ProductForPublication,
  type PublicationData,
} from "./publication-rules";
import {
  createItem,
  findListingIdBySku,
  getCategory,
  getCategoryAttributes,
  getFreeShippingCost,
  getListingPrices,
  updateDescription,
  updateItem,
  validateItem,
  type CategoryInfo,
} from "./publish-api";
import { getListing } from "../listings-api";

// Publicar un producto en Mercado Libre desde el sistema y editar su
// contenido (specs/025, plan secciones 3.3 a 3.5). Las decisiones están en
// archivos puros; esto las junta con la base y con Mercado Libre. Quien llama
// valida el permiso.

/** Una publicación reclamada hace más que esto se da por perdida (Mercado Libre no respondió). */
const PUBLISH_CLAIM_TTL_MS = 2 * 60 * 1000;

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  barcodeIsGenerated: true,
  photoUrl: true,
  salePrice: true,
  purchasePrice: true,
  currentStock: true,
  active: true,
  brand: { select: { name: true } },
  mlLinkedListing: { select: { id: true, mlItemId: true, permalink: true, status: true, publishedFromSystem: true } },
  mlPublicationData: true,
} as const;

async function loadProduct(productId: string) {
  return prisma.product.findUnique({ where: { id: productId }, select: productSelect });
}
type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

function forPublication(product: LoadedProduct): ProductForPublication {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    barcodeIsGenerated: product.barcodeIsGenerated,
    photoUrl: product.photoUrl,
    salePrice: product.salePrice.toString(),
  };
}

async function loadDefaults() {
  const settings = await prisma.setting.findUnique({
    where: { id: "singleton" },
    select: { mlDefaultListingType: true, mlDefaultWarrantyType: true, mlDefaultWarrantyDays: true, mlDefaultLocalPickUp: true },
  });
  return {
    listingType: settings?.mlDefaultListingType ?? "gold_special",
    warrantyType: settings ? settings.mlDefaultWarrantyType : "SELLER",
    warrantyDays: settings ? settings.mlDefaultWarrantyDays : 30,
    localPickUp: settings?.mlDefaultLocalPickUp ?? true,
  };
}

/** Lo guardado, o los datos iniciales si el producto todavía no tiene (RF-1, RF-5). */
async function dataOf(product: LoadedProduct): Promise<PublicationData> {
  if (product.mlPublicationData) return publicationDataFromRow(product.mlPublicationData);
  return initialPublicationData({ name: product.name, brandName: product.brand?.name ?? null }, await loadDefaults());
}

// ---------------------------------------------------------------------------
// Categoría
// ---------------------------------------------------------------------------

export type CategoryForm = {
  info: CategoryInfo;
  fields: CategoryField[];
  rules: CategoryRules;
  /** Motivos para publicar sin código universal (RF-2). */
  emptyGtinReasons: { id: string; name: string }[];
};

/** Lo que pide la categoría: datos, campos del formulario y reglas para publicar. */
export async function loadCategoryForm(categoryId: string): Promise<CategoryForm> {
  const [info, attributes] = await Promise.all([getCategory(categoryId), getCategoryAttributes(categoryId)]);
  const fields = categoryFields(attributes);
  return {
    info,
    fields,
    rules: {
      fields,
      gtin: categoryAsksGtin(attributes),
      maxTitleLength: info.maxTitleLength,
      maxPictures: info.maxPictures,
      minimumPrice: info.minimumPrice,
    },
    emptyGtinReasons: emptyGtinReasons(attributes),
  };
}

const namesOf = (fields: readonly CategoryField[]) => Object.fromEntries(fields.map((f) => [f.id, f.name]));

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

export type PublicationForm = {
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string;
    barcodeIsGenerated: boolean;
    photoUrl: string | null;
    salePrice: string;
    currentStock: number;
    active: boolean;
  };
  data: PublicationData;
  saved: boolean;
  suggestedCategoryId: string | null;
  categoryName: string | null;
  lastError: string | null;
  /** La publicación vigente del producto, si tiene. */
  listing: { mlItemId: string; permalink: string; status: string; publishedFromSystem: boolean } | null;
};

export async function loadPublicationForm(productId: string): Promise<PublicationForm | null> {
  const product = await loadProduct(productId);
  if (!product) return null;
  const row = product.mlPublicationData;
  return {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      barcodeIsGenerated: product.barcodeIsGenerated,
      photoUrl: product.photoUrl,
      salePrice: product.salePrice.toString(),
      currentStock: product.currentStock,
      active: product.active,
    },
    data: await dataOf(product),
    saved: row !== null,
    suggestedCategoryId: row?.suggestedCategoryId ?? null,
    categoryName: row?.categoryName ?? null,
    lastError: row?.lastError ?? null,
    listing: product.mlLinkedListing,
  };
}

// ---------------------------------------------------------------------------
// Guardar (RF-1)
// ---------------------------------------------------------------------------

const positiveInt = (max: number) => z.number().int().min(1).max(max).nullable();

/** Lo que manda el formulario. Se valida acá: nunca se confía en el navegador. */
export const publicationInputSchema = z.object({
  title: z.string().trim().max(200),
  categoryId: z.string().trim().regex(/^MLA\d+$/).nullable(),
  categoryName: z.string().trim().max(200).nullable(),
  suggestedCategoryId: z.string().trim().regex(/^MLA\d+$/).nullable(),
  attributes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        valueId: z.string().trim().max(100).nullable().optional(),
        valueName: z.string().trim().max(255).nullable().optional(),
      }),
    )
    .max(150),
  description: z.string().max(50_000),
  useProductPhoto: z.boolean(),
  extraPhotoUrls: z.array(z.string().url().startsWith("https://")).max(12),
  listingType: z.enum(["gold_special", "gold_pro"]),
  warrantyType: z.enum(["SELLER", "FACTORY"]).nullable(),
  warrantyDays: positiveInt(3650),
  localPickUp: z.boolean(),
  packageHeightCm: positiveInt(500),
  packageWidthCm: positiveInt(500),
  packageLengthCm: positiveInt(500),
  packageWeightG: positiveInt(100_000),
  emptyGtinReason: z.string().trim().max(20).nullable(),
  /** Solo si el producto no tiene SKU: se guarda en el producto (plan, sección 3.4). */
  sku: z.string().trim().max(60).nullable(),
  /** Precio de venta del producto, cambiado desde el formulario (RF-4b). Sin valor: no se toca. */
  salePrice: z.string().trim().max(20).nullable().optional(),
});
export type PublicationInput = z.infer<typeof publicationInputSchema>;

function toData(input: PublicationInput): PublicationData {
  return {
    title: input.title,
    categoryId: input.categoryId,
    attributes: input.attributes.map((a) => ({ id: a.id, valueId: a.valueId ?? null, valueName: a.valueName ?? null })),
    description: input.description,
    useProductPhoto: input.useProductPhoto,
    extraPhotoUrls: input.extraPhotoUrls,
    listingType: input.listingType,
    warrantyType: input.warrantyType,
    warrantyDays: input.warrantyType ? input.warrantyDays : null,
    localPickUp: input.localPickUp,
    packageHeightCm: input.packageHeightCm,
    packageWidthCm: input.packageWidthCm,
    packageLengthCm: input.packageLengthCm,
    packageWeightG: input.packageWeightG,
    emptyGtinReason: input.emptyGtinReason,
  };
}

function rowData(data: PublicationData, input: Pick<PublicationInput, "categoryName" | "suggestedCategoryId">, userId: string) {
  return {
    title: data.title,
    categoryId: data.categoryId,
    categoryName: data.categoryId ? input.categoryName : null,
    suggestedCategoryId: input.suggestedCategoryId,
    attributes: data.attributes as Prisma.InputJsonValue,
    description: data.description,
    useProductPhoto: data.useProductPhoto,
    extraPhotoUrls: data.extraPhotoUrls,
    listingType: data.listingType,
    warrantyType: data.warrantyType,
    warrantyDays: data.warrantyDays,
    localPickUp: data.localPickUp,
    packageHeightCm: data.packageHeightCm,
    packageWidthCm: data.packageWidthCm,
    packageLengthCm: data.packageLengthCm,
    packageWeightG: data.packageWeightG,
    emptyGtinReason: data.emptyGtinReason,
    updatedByUserId: userId,
  };
}

/**
 * Aplica un cambio de precio como la ficha del producto (spec 004; spec 020,
 * RF-13): el precio, su historial y la marca de precio pendiente de la
 * publicación vigente. Devuelve si hay que enviar a Mercado Libre.
 */
async function applySalePrice(tx: Prisma.TransactionClient, productId: string, change: PriceChange, userId: string): Promise<boolean> {
  if (change.kind !== "change") return false;
  const product = await tx.product.update({ where: { id: productId }, data: { salePrice: change.value }, select: { purchasePrice: true } });
  await tx.productPriceHistory.create({
    data: { productId, purchasePrice: product.purchasePrice, salePrice: change.value, changedByUserId: userId },
  });
  return (await markPricePending(tx, [productId])) > 0;
}

export type SaveResult = { error: string } | { ok: true };

/**
 * «Guardar» (RF-1): no llama a Mercado Libre. Si el producto no tiene SKU y se
 * cargó uno, lo guarda en el producto; si cambió el precio, lo aplica (RF-4b).
 */
export async function savePublicationData(productId: string, raw: unknown, userId: string, canChangePrice: boolean): Promise<SaveResult> {
  const parsed = publicationInputSchema.safeParse(raw);
  if (!parsed.success) return { error: "Hay datos que no son válidos. Revisá el formulario." };
  const input = parsed.data;
  const product = await loadProduct(productId);
  if (!product) return { error: "El producto no existe." };
  if (product.mlLinkedListing?.publishedFromSystem) {
    return { error: "El producto ya está publicado: usá «Guardar y enviar a Mercado Libre»." };
  }
  const price = salePriceChange(product.salePrice.toString(), input.salePrice, canChangePrice);
  if (price.kind === "invalid" || price.kind === "denied") return { error: price.message };

  let sku: { sku: string; skuKey: string } | null = null;
  if (!product.sku && input.sku) {
    const normalized = normalizeSku(input.sku);
    if (!normalized.ok) return { error: normalized.error };
    const owner = await prisma.product.findUnique({ where: { skuKey: normalized.skuKey }, select: { id: true } });
    if (owner && owner.id !== product.id) return { error: "Ese SKU ya lo tiene otro producto." };
    sku = { sku: normalized.sku, skuKey: normalized.skuKey };
  }

  const data = rowData(toData(input), input, userId);
  let pushPrice = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.mercadoLibrePublicationData.upsert({ where: { productId }, create: { productId, ...data }, update: data });
      if (sku) await tx.product.update({ where: { id: productId }, data: sku });
      pushPrice = await applySalePrice(tx, productId, price, userId);
    });
  } catch {
    return { error: "No se pudieron guardar los datos. Probá de nuevo." };
  }
  if (pushPrice) scheduleListingPush([productId]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Revisar (RF-6)
// ---------------------------------------------------------------------------

export type ReviewOutcome = { missing: MissingItem[]; errors: string[]; warnings: string[] };

/** Lo que falta y, si no falta nada, la revisión de Mercado Libre sin crear nada. */
async function review(product: LoadedProduct, data: PublicationData): Promise<ReviewOutcome & { form: CategoryForm | null }> {
  const form = data.categoryId ? await loadCategoryForm(data.categoryId) : null;
  const missing = missingForPublishing(data, forPublication(product), form?.rules ?? null);
  if (missing.length > 0 || !form) return { missing, errors: [], warnings: [], form };
  const body = buildCreateBody(data, forPublication(product), form.rules, publishableQuantity(product.currentStock));
  const result = await validateItem(body, namesOf(form.fields));
  return { missing, ...result, form };
}

/** «Revisar con Mercado Libre»: con lo guardado. */
export async function reviewPublication(productId: string): Promise<ReviewOutcome | { error: string }> {
  const product = await loadProduct(productId);
  if (!product) return { error: "El producto no existe." };
  const connection = await requireMlConnection();
  if (!connection.ok) return { error: connection.error };
  try {
    const { missing, errors, warnings } = await review(product, await dataOf(product));
    return { missing, errors, warnings };
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Estimación (RF-4)
// ---------------------------------------------------------------------------

/** La estimación con lo que se ve en el formulario. `withCost`: el usuario tiene el permiso de costos. */
export async function estimatePublication(
  productId: string,
  input: {
    categoryId: string;
    listingType: "gold_special" | "gold_pro";
    package: { heightCm: number; widthCm: number; lengthCm: number; weightG: number } | null;
    /** El precio que se está escribiendo (RF-4b); sin valor, el del producto. */
    price?: string | null;
  },
  withCost: boolean,
): Promise<Estimate | { error: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { salePrice: true, purchasePrice: true } });
  if (!product) return { error: "El producto no existe." };
  const connection = await requireMlConnection();
  if (!connection.ok) return { error: connection.error };
  const typed = input.price ? parsePrice(input.price) : null;
  if (input.price && !typed) return { error: "Cargá un precio de venta válido." };
  const priceText = (typed ?? product.salePrice).toString();
  const price = Number(priceText);
  try {
    const [prices, shippingCost] = await Promise.all([
      getListingPrices(price, input.categoryId),
      input.package
        ? getFreeShippingCost({ mlUserId: connection.mlUserId, price, listingType: input.listingType, ...input.package }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const result = estimate({
      price: priceText,
      listingType: input.listingType,
      prices,
      shippingCost,
      purchasePrice: withCost ? product.purchasePrice.toString() : null,
    });
    return result ?? { error: "Mercado Libre no informó lo que cobra por este tipo de publicación." };
  } catch (error) {
    return { error: mlErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Publicar (RF-6 a RF-8)
// ---------------------------------------------------------------------------

export type PublishResult =
  | { ok: true; mlItemId: string; permalink: string; warnings: string[] }
  | { ok: false; error?: string; missing?: MissingItem[]; errors?: string[]; warnings?: string[] };

async function releaseClaim(productId: string, lastError: string | null): Promise<void> {
  await prisma.mercadoLibrePublicationData.update({ where: { productId }, data: { publishingAt: null, lastError } });
}

/** Guarda la publicación creada como vinculada al producto, igual que al vincular (spec 020). */
async function linkCreated(product: LoadedProduct, item: MlItem, userId: string): Promise<{ mlItemId: string; permalink: string }> {
  const read = readListing(item);
  const status = mapListingStatus(read.mlStatus, read.mlSubStatus);
  await prisma.$transaction(async (tx) => {
    const listing = await tx.mercadoLibreListing.create({
      data: {
        mlItemId: read.mlItemId,
        mlVariationId: read.variationId,
        productId: product.id,
        linkedProductId: product.id,
        title: read.title,
        thumbnailUrl: read.thumbnailUrl,
        permalink: read.permalink,
        categoryId: read.categoryId,
        status: status.status,
        mlStatus: read.mlStatus,
        mlSubStatus: read.mlSubStatus,
        statusReason: status.reason,
        lastKnownPrice: read.price,
        lastKnownSku: read.sku,
        lastKnownQuantity: read.quantity,
        lastQuantitySyncAt: new Date(),
        lastReadAt: new Date(),
        linkedByUserId: userId,
        publishedFromSystem: true,
      },
    });
    await tx.mercadoLibrePublicationData.update({ where: { productId: product.id }, data: { publishingAt: null, lastError: null } });
    await logAudit(tx, {
      userId,
      action: "ML_LISTING_LINKED",
      targetType: "MercadoLibreListing",
      targetId: listing.id,
      detail: { mlItemId: read.mlItemId, productId: product.id, publicadaDesdeElSistema: true },
    });
  });
  return { mlItemId: read.mlItemId, permalink: read.permalink };
}

/**
 * Si un intento anterior quedó sin respuesta, la publicación pudo haberse
 * creado igual: se busca por el SKU antes de crear otra (caso borde de la spec).
 */
async function recoverBySku(product: LoadedProduct, mlUserId: string, userId: string): Promise<{ mlItemId: string; permalink: string } | null> {
  if (!product.sku) return null;
  const found = await findListingIdBySku(mlUserId, product.sku);
  if (!found) return null;
  const already = await prisma.mercadoLibreListing.findUnique({ where: { mlItemId: found }, select: { id: true } });
  if (already) return null;
  return linkCreated(product, await getListing(found), userId);
}

/** «Publicar» (plan, sección 3.4). */
export async function publishProduct(productId: string, userId: string): Promise<PublishResult> {
  const connection = await requireMlConnection();
  if (!connection.ok) return { ok: false, error: connection.error };
  const product = await loadProduct(productId);
  if (!product) return { ok: false, error: "El producto no existe." };
  if (!product.active) return { ok: false, error: "El producto está desactivado: activalo antes de publicarlo." };
  if (product.mlLinkedListing) return { ok: false, error: "El producto ya tiene una publicación vigente." };
  const row = product.mlPublicationData;
  if (!row) return { ok: false, error: "Guardá los datos de publicación antes de publicar." };

  const now = Date.now();
  const stale = row.publishingAt !== null && now - row.publishingAt.getTime() >= PUBLISH_CLAIM_TTL_MS;
  const claim = await prisma.mercadoLibrePublicationData.updateMany({
    where: { productId, OR: [{ publishingAt: null }, { publishingAt: { lt: new Date(now - PUBLISH_CLAIM_TTL_MS) } }] },
    data: { publishingAt: new Date(now) },
  });
  if (claim.count === 0) {
    return { ok: false, error: "El producto ya se está publicando, o Mercado Libre no respondió hace un momento. Esperá dos minutos y probá de nuevo." };
  }

  try {
    if (stale) {
      const recovered = await recoverBySku(product, connection.mlUserId, userId);
      if (recovered) return { ok: true, ...recovered, warnings: ["La publicación de un intento anterior ya estaba creada en Mercado Libre: quedó vinculada."] };
    }

    const data = publicationDataFromRow(row);
    const { missing, errors, warnings, form } = await review(product, data);
    if (missing.length > 0 || errors.length > 0 || !form) {
      await releaseClaim(productId, errors[0] ?? null);
      return { ok: false, missing, errors, warnings };
    }

    const body = buildCreateBody(data, forPublication(product), form.rules, publishableQuantity(product.currentStock));
    let item: MlItem;
    try {
      item = await createItem(body);
    } catch (error) {
      if (error instanceof MlApiError && error.status >= 400 && error.status < 500) {
        const rejected = classifyCauses(causesOf(error.body), namesOf(form.fields));
        const messages = rejected.errors.length > 0 ? rejected.errors : [mlErrorMessage(error)];
        await releaseClaim(productId, messages[0]);
        return { ok: false, errors: messages, warnings: rejected.warnings };
      }
      if (error instanceof MlUnavailableError) {
        // No se sabe si se creó. La búsqueda por SKU tarda unos segundos en ver una publicación
        // nueva (T-009), así que el reclamo NO se libera: el próximo intento, pasado el plazo,
        // busca por SKU antes de crear otra.
        const recovered = await recoverBySku(product, connection.mlUserId, userId).catch(() => null);
        if (recovered) return { ok: true, ...recovered, warnings };
        await prisma.mercadoLibrePublicationData.update({ where: { productId }, data: { lastError: "Mercado Libre no respondió al publicar." } });
        return {
          ok: false,
          error: "Mercado Libre no respondió. Esperá dos minutos y probá de nuevo: antes de publicar otra vez, el sistema revisa si la publicación se llegó a crear.",
        };
      }
      throw error;
    }
    const linked = await linkCreated(product, item, userId);
    return { ok: true, ...linked, warnings };
  } catch (error) {
    await releaseClaim(productId, mlErrorMessage(error)).catch(() => undefined);
    return { ok: false, error: mlErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Editar (RF-9)
// ---------------------------------------------------------------------------

export type UpdateResult = { ok: true; changed: boolean; warnings: string[] } | { ok: false; error?: string; missing?: MissingItem[]; errors?: string[] };

/** «Guardar y enviar a Mercado Libre» en una publicación creada desde el sistema (plan, sección 3.5). */
export async function updatePublication(productId: string, raw: unknown, userId: string, canChangePrice: boolean): Promise<UpdateResult> {
  const parsed = publicationInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Hay datos que no son válidos. Revisá el formulario." };
  const connection = await requireMlConnection();
  if (!connection.ok) return { ok: false, error: connection.error };
  const product = await loadProduct(productId);
  if (!product) return { ok: false, error: "El producto no existe." };
  const listing = product.mlLinkedListing;
  if (!listing || !listing.publishedFromSystem || !product.mlPublicationData) {
    return { ok: false, error: "Solo se edita desde el sistema una publicación creada desde el sistema." };
  }

  const price = salePriceChange(product.salePrice.toString(), parsed.data.salePrice, canChangePrice);
  if (price.kind === "invalid" || price.kind === "denied") return { ok: false, error: price.message };

  const before = publicationDataFromRow(product.mlPublicationData);
  // La categoría de una publicación no cambia: Mercado Libre no lo permite con ventas.
  const after: PublicationData = { ...toData(parsed.data), categoryId: before.categoryId };
  const form = before.categoryId ? await loadCategoryForm(before.categoryId) : null;
  if (!form) return { ok: false, error: "La publicación no tiene categoría guardada." };
  // Con el precio que se está guardando, no el anterior (por ejemplo, para el mínimo de la categoría).
  const productNow = { ...forPublication(product), salePrice: price.kind === "change" ? price.value : product.salePrice.toString() };
  const missing = missingForPublishing(after, productNow, form.rules);
  if (missing.length > 0) return { ok: false, missing };

  const { item, description } = buildUpdateBody(before, after, productNow, form.rules);
  let saved = after;
  let updated: MlItem | null = null;
  try {
    if (Object.keys(item).length > 0) updated = await updateItem(listing.mlItemId, item);
  } catch (error) {
    const rejected = error instanceof MlApiError ? classifyCauses(causesOf(error.body), namesOf(form.fields)) : null;
    return { ok: false, errors: rejected?.errors.length ? rejected.errors : [mlErrorMessage(error)] };
  }
  const warnings: string[] = [];
  if (description !== null) {
    try {
      await updateDescription(listing.mlItemId, description);
    } catch (error) {
      // Lo demás ya cambió en Mercado Libre: se guarda, con la descripción anterior.
      saved = { ...after, description: before.description };
      warnings.push(`La descripción no se pudo cambiar: ${mlErrorMessage(error)}`);
    }
  }

  let pushPrice = false;
  await prisma.$transaction(async (tx) => {
    // El precio va por el camino de siempre (spec 020, RF-13): se marca y se envía después.
    pushPrice = await applySalePrice(tx, productId, price, userId);
    await tx.mercadoLibrePublicationData.update({
      where: { productId },
      data: rowData(saved, { categoryName: product.mlPublicationData!.categoryName, suggestedCategoryId: product.mlPublicationData!.suggestedCategoryId }, userId),
    });
    if (updated) {
      const read = readListing(updated);
      await tx.mercadoLibreListing.update({ where: { id: listing.id }, data: { title: read.title, thumbnailUrl: read.thumbnailUrl, lastReadAt: new Date() } });
    }
  });
  if (pushPrice) scheduleListingPush([productId]);
  return { ok: true, changed: Object.keys(item).length > 0 || description !== null || price.kind === "change", warnings };
}
