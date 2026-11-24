// Qué le falta a un producto para publicarse en Mercado Libre y qué se hace
// con su código universal (specs/025, RF-2 y RF-6; plan sección 3.1). Pura.
import { hasValue, type AttributeValue, type CategoryField } from "./category-form";

export type ListingType = "gold_special" | "gold_pro";
export type WarrantyType = "SELLER" | "FACTORY";

/** Los datos de publicación, como se guardan (`ml_publication_data`). */
export type PublicationData = {
  title: string;
  categoryId: string | null;
  attributes: AttributeValue[];
  description: string;
  useProductPhoto: boolean;
  extraPhotoUrls: string[];
  listingType: ListingType;
  /** `null`: sin garantía. */
  warrantyType: WarrantyType | null;
  warrantyDays: number | null;
  localPickUp: boolean;
  packageHeightCm: number | null;
  packageWidthCm: number | null;
  packageLengthCm: number | null;
  packageWeightG: number | null;
  emptyGtinReason: string | null;
};

/** Lo que sale del producto del catálogo al publicar. */
export type ProductForPublication = {
  name: string;
  sku: string | null;
  barcode: string;
  barcodeIsGenerated: boolean;
  photoUrl: string | null;
  /** En pesos, como texto para no perder precisión. */
  salePrice: string;
};

/** Lo que dice la categoría elegida (`/categories/{id}` y sus características). */
export type CategoryRules = {
  fields: CategoryField[];
  gtin: { gtin: boolean; required: boolean };
  maxTitleLength: number;
  maxPictures: number;
  minimumPrice: number | null;
};

export type GtinDecision =
  /** El código de barras de origen se manda como código universal. */
  | { kind: "send"; value: string }
  /** Sin código: se manda el motivo (lo pide la categoría). */
  | { kind: "empty" }
  /** La categoría no pide código. */
  | { kind: "none" }
  /** La categoría exige el código y el producto no tiene uno de origen. */
  | { kind: "blocked"; message: string };

/**
 * El código universal (RF-2): el de origen sí; uno generado por el sistema
 * nunca, porque no existe fuera del local.
 */
export function gtinDecision(product: Pick<ProductForPublication, "barcode" | "barcodeIsGenerated">, gtin: CategoryRules["gtin"]): GtinDecision {
  if (!gtin.gtin) return { kind: "none" };
  if (!product.barcodeIsGenerated && product.barcode.trim()) return { kind: "send", value: product.barcode.trim() };
  if (gtin.required) {
    return {
      kind: "blocked",
      message: "Esta categoría exige el código universal del producto, y el código de barras de este producto lo generó el sistema. Elegí otra categoría o cargá el código de origen en el producto.",
    };
  }
  return { kind: "empty" };
}

/** Un dato que falta, con el campo del formulario al que lleva (RF-6). */
export type MissingItem = { field: string; message: string };

export function photoUrls(data: Pick<PublicationData, "useProductPhoto" | "extraPhotoUrls">, product: Pick<ProductForPublication, "photoUrl">): string[] {
  const urls = [...(data.useProductPhoto && product.photoUrl ? [product.photoUrl] : []), ...data.extraPhotoUrls];
  return [...new Set(urls)];
}

/** Todo lo que falta o está mal antes de mandar nada a Mercado Libre (RF-6). Vacío: se puede revisar con Mercado Libre. */
export function missingForPublishing(data: PublicationData, product: ProductForPublication, rules: CategoryRules | null): MissingItem[] {
  const missing: MissingItem[] = [];
  const title = data.title.trim();
  if (!title) missing.push({ field: "title", message: "Falta el título." });
  else if (rules && title.length > rules.maxTitleLength) {
    missing.push({ field: "title", message: `El título tiene ${title.length} caracteres: el máximo de la categoría es ${rules.maxTitleLength}.` });
  }

  if (!product.sku?.trim()) missing.push({ field: "sku", message: "Falta el SKU del producto: identifica la publicación (spec 020)." });

  if (!data.categoryId || !rules) {
    missing.push({ field: "category", message: "Falta elegir la categoría." });
  } else {
    for (const field of rules.fields.filter((f) => f.group === "required")) {
      if (!hasValue(data.attributes.find((a) => a.id === field.id))) {
        missing.push({ field: `attr:${field.id}`, message: `Falta «${field.name}».` });
      }
    }
    const gtin = gtinDecision(product, rules.gtin);
    if (gtin.kind === "blocked") missing.push({ field: "gtin", message: gtin.message });
    if (gtin.kind === "empty" && !data.emptyGtinReason) {
      missing.push({ field: "gtin", message: "El producto no tiene código universal de origen: elegí el motivo." });
    }
    const price = Number(product.salePrice);
    if (rules.minimumPrice !== null && price < rules.minimumPrice) {
      missing.push({ field: "price", message: `El precio de venta es menor que el mínimo de la categoría ($${rules.minimumPrice}).` });
    }
  }

  const photos = photoUrls(data, product);
  if (photos.length === 0) missing.push({ field: "photos", message: "Falta al menos una foto." });
  else if (rules && photos.length > rules.maxPictures) {
    missing.push({ field: "photos", message: `Hay ${photos.length} fotos: el máximo de la categoría es ${rules.maxPictures}.` });
  }

  const pkg = [data.packageHeightCm, data.packageWidthCm, data.packageLengthCm, data.packageWeightG];
  if (pkg.some((v) => v === null || !Number.isInteger(v) || v <= 0)) {
    missing.push({ field: "package", message: "Faltan las medidas o el peso del paquete embalado (números enteros mayores que cero)." });
  }

  if (data.warrantyType && !(data.warrantyDays && data.warrantyDays > 0)) {
    missing.push({ field: "warranty", message: "Falta el plazo de la garantía." });
  }
  return missing;
}

/** Los valores por defecto de Configuración > Mercado Libre (RF-5). */
export type PublicationDefaults = {
  listingType: string;
  warrantyType: string | null;
  warrantyDays: number | null;
  localPickUp: boolean;
};

export function asListingType(value: unknown): ListingType {
  return value === "gold_pro" ? "gold_pro" : "gold_special";
}

export function asWarrantyType(value: unknown): WarrantyType | null {
  return value === "SELLER" || value === "FACTORY" ? value : null;
}

/**
 * Los datos con los que arranca el formulario de un producto que todavía no
 * tiene (RF-2, RF-5): título = nombre, marca del producto, foto del catálogo y
 * los valores por defecto.
 */
export function initialPublicationData(product: { name: string; brandName: string | null }, defaults: PublicationDefaults): PublicationData {
  const warrantyType = asWarrantyType(defaults.warrantyType);
  return {
    title: product.name.trim(),
    categoryId: null,
    attributes: product.brandName ? [{ id: "BRAND", valueName: product.brandName }] : [],
    description: "",
    useProductPhoto: true,
    extraPhotoUrls: [],
    listingType: asListingType(defaults.listingType),
    warrantyType,
    warrantyDays: warrantyType ? defaults.warrantyDays : null,
    localPickUp: defaults.localPickUp,
    packageHeightCm: null,
    packageWidthCm: null,
    packageLengthCm: null,
    packageWeightG: null,
    emptyGtinReason: null,
  };
}

/** Lo guardado en la base (`attributes` es JSON) como `PublicationData`; lo que no tiene la forma esperada se descarta. */
export function publicationDataFromRow(row: {
  title: string;
  categoryId: string | null;
  attributes: unknown;
  description: string;
  useProductPhoto: boolean;
  extraPhotoUrls: string[];
  listingType: string;
  warrantyType: string | null;
  warrantyDays: number | null;
  localPickUp: boolean;
  packageHeightCm: number | null;
  packageWidthCm: number | null;
  packageLengthCm: number | null;
  packageWeightG: number | null;
  emptyGtinReason: string | null;
}): PublicationData {
  const attributes = Array.isArray(row.attributes)
    ? row.attributes.flatMap((a): AttributeValue[] => {
        if (!a || typeof a !== "object" || typeof (a as { id?: unknown }).id !== "string") return [];
        const { id, valueId, valueName } = a as { id: string; valueId?: unknown; valueName?: unknown };
        return [{ id, valueId: typeof valueId === "string" ? valueId : null, valueName: typeof valueName === "string" ? valueName : null }];
      })
    : [];
  return {
    title: row.title,
    categoryId: row.categoryId,
    attributes,
    description: row.description,
    useProductPhoto: row.useProductPhoto,
    extraPhotoUrls: row.extraPhotoUrls,
    listingType: asListingType(row.listingType),
    warrantyType: asWarrantyType(row.warrantyType),
    warrantyDays: row.warrantyDays,
    localPickUp: row.localPickUp,
    packageHeightCm: row.packageHeightCm,
    packageWidthCm: row.packageWidthCm,
    packageLengthCm: row.packageLengthCm,
    packageWeightG: row.packageWeightG,
    emptyGtinReason: row.emptyGtinReason,
  };
}
