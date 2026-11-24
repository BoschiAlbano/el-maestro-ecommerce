import { describe, expect, it } from "vitest";
import cable from "./__fixtures__/attributes-cable-MLA5338.json";
import { categoryAsksGtin, categoryFields, type MlCategoryAttribute } from "./category-form";
import { buildCreateBody, buildUpdateBody, WARRANTY_TYPE_IDS } from "./publication-body";
import {
  gtinDecision,
  initialPublicationData,
  missingForPublishing,
  publicationDataFromRow,
  type CategoryRules,
  type ProductForPublication,
  type PublicationData,
} from "./publication-rules";

const cableAttrs = cable as MlCategoryAttribute[];
const rules: CategoryRules = {
  fields: categoryFields(cableAttrs),
  gtin: categoryAsksGtin(cableAttrs),
  maxTitleLength: 60,
  maxPictures: 12,
  minimumPrice: 1000,
};

const product: ProductForPublication = {
  name: "Cable USB-C a USB-A trenzado 1 metro",
  sku: "PRUEBA-025",
  barcode: "2000000000017",
  barcodeIsGenerated: true,
  photoUrl: "https://example.supabase.co/storage/v1/object/public/product-photos/cable.webp",
  salePrice: "7500",
};

const data: PublicationData = {
  title: "Cable USB-C a USB-A Trenzado 1 Metro",
  categoryId: "MLA5338",
  attributes: [
    { id: "BRAND", valueName: "Genérico" },
    { id: "INPUT_CONNECTOR", valueName: "USB-C" },
    { id: "OUTPUT_CONNECTOR", valueName: "USB-A" },
  ],
  description: "Cable trenzado de 1 metro.",
  useProductPhoto: true,
  extraPhotoUrls: [],
  listingType: "gold_special",
  warrantyType: "SELLER",
  warrantyDays: 30,
  localPickUp: true,
  packageHeightCm: 3,
  packageWidthCm: 10,
  packageLengthCm: 15,
  packageWeightG: 100,
  emptyGtinReason: "17055160",
};

describe("código universal (RF-2)", () => {
  it("el de origen se manda", () => {
    expect(gtinDecision({ barcode: "7790001234567", barcodeIsGenerated: false }, rules.gtin)).toEqual({ kind: "send", value: "7790001234567" });
  });

  it("uno generado por el sistema no se manda: va el motivo", () => {
    expect(gtinDecision(product, rules.gtin)).toEqual({ kind: "empty" });
  });

  it("si la categoría lo exige y el código es generado, no se puede publicar ahí", () => {
    expect(gtinDecision(product, { gtin: true, required: true }).kind).toBe("blocked");
  });

  it("una categoría sin código universal no lo pide", () => {
    expect(gtinDecision(product, { gtin: false, required: false })).toEqual({ kind: "none" });
  });
});

describe("missingForPublishing (RF-6)", () => {
  it("con todo cargado no falta nada", () => {
    expect(missingForPublishing(data, product, rules)).toEqual([]);
  });

  it("cada dato faltante, con su campo", () => {
    const empty: PublicationData = {
      ...data,
      title: " ",
      attributes: [{ id: "BRAND", valueName: "Genérico" }],
      useProductPhoto: false,
      packageWeightG: null,
      warrantyDays: null,
      emptyGtinReason: null,
    };
    const fields = missingForPublishing(empty, { ...product, sku: null }, rules).map((m) => m.field);
    expect(fields).toEqual(["title", "sku", "attr:INPUT_CONNECTOR", "attr:OUTPUT_CONNECTOR", "gtin", "photos", "package", "warranty"]);
  });

  it("sin categoría no se revisan las características", () => {
    expect(missingForPublishing({ ...data, categoryId: null }, product, null).map((m) => m.field)).toEqual(["category"]);
  });

  it("título largo, precio bajo y demasiadas fotos", () => {
    const fields = missingForPublishing(
      { ...data, title: "x".repeat(61), extraPhotoUrls: Array.from({ length: 12 }, (_, i) => `https://f/${i}.jpg`) },
      { ...product, salePrice: "999" },
      rules,
    ).map((m) => m.message);
    expect(fields).toEqual([
      "El título tiene 61 caracteres: el máximo de la categoría es 60.",
      "El precio de venta es menor que el mínimo de la categoría ($1000).",
      "Hay 13 fotos: el máximo de la categoría es 12.",
    ]);
  });

  it("sin garantía no pide plazo", () => {
    expect(missingForPublishing({ ...data, warrantyType: null, warrantyDays: null }, product, rules)).toEqual([]);
  });
});

describe("buildCreateBody: el alta de la prueba técnica", () => {
  it("arma el cuerpo que Mercado Libre aceptó", () => {
    const body = buildCreateBody(data, product, rules, 4);
    expect(body).toMatchObject({
      title: "Cable USB-C a USB-A Trenzado 1 Metro",
      category_id: "MLA5338",
      price: 7500,
      currency_id: "ARS",
      available_quantity: 4,
      condition: "new",
      listing_type_id: "gold_special",
      pictures: [{ source: product.photoUrl }],
      description: { plain_text: "Cable trenzado de 1 metro." },
      sale_terms: [
        { id: "WARRANTY_TYPE", value_id: "2230280" },
        { id: "WARRANTY_TIME", value_name: "30 días" },
      ],
      shipping: { mode: "me2", local_pick_up: true },
    });
    expect(body.attributes).toEqual([
      { id: "BRAND", value_name: "Genérico" },
      { id: "INPUT_CONNECTOR", value_name: "USB-C" },
      { id: "OUTPUT_CONNECTOR", value_name: "USB-A" },
      { id: "SELLER_SKU", value_name: "PRUEBA-025" },
      { id: "EMPTY_GTIN_REASON", value_id: "17055160" },
      { id: "SELLER_PACKAGE_HEIGHT", value_name: "3 cm" },
      { id: "SELLER_PACKAGE_WIDTH", value_name: "10 cm" },
      { id: "SELLER_PACKAGE_LENGTH", value_name: "15 cm" },
      { id: "SELLER_PACKAGE_WEIGHT", value_name: "100 g" },
    ]);
  });

  it("con código de origen manda el GTIN y no el motivo", () => {
    const attrs = buildCreateBody(data, { ...product, barcode: "7790001234567", barcodeIsGenerated: false }, rules, 1).attributes;
    expect(attrs).toContainEqual({ id: "GTIN", value_name: "7790001234567" });
    expect(attrs.some((a) => a.id === "EMPTY_GTIN_REASON")).toBe(false);
  });

  it("Premium, sin retiro, sin garantía y sin stock (RF-7)", () => {
    const body = buildCreateBody({ ...data, listingType: "gold_pro", localPickUp: false, warrantyType: null, warrantyDays: null }, product, rules, -2);
    expect(body.listing_type_id).toBe("gold_pro");
    expect(body.shipping).toEqual({ mode: "me2", local_pick_up: false });
    expect(body.sale_terms).toEqual([{ id: "WARRANTY_TYPE", value_id: WARRANTY_TYPE_IDS.NONE }]);
    expect(body.available_quantity).toBe(0);
  });

  it("la foto del catálogo va primera y no se repite", () => {
    const body = buildCreateBody({ ...data, extraPhotoUrls: ["https://f/2.jpg", product.photoUrl!] }, product, rules, 1);
    expect(body.pictures).toEqual([{ source: product.photoUrl }, { source: "https://f/2.jpg" }]);
  });
});

describe("buildUpdateBody (RF-9)", () => {
  it("sin cambios no manda nada", () => {
    expect(buildUpdateBody(data, { ...data }, product, rules)).toEqual({ item: {}, description: null });
  });

  it("solo lo que cambió; la descripción aparte", () => {
    const after = { ...data, title: "Cable USB-C Trenzado Reforzado", description: "Nueva descripción.", extraPhotoUrls: ["https://f/2.jpg"] };
    const update = buildUpdateBody(data, after, product, rules);
    expect(Object.keys(update.item).sort()).toEqual(["pictures", "title"]);
    expect(update.description).toBe("Nueva descripción.");
  });

  it("cambiar la garantía o el retiro manda esos datos", () => {
    const update = buildUpdateBody(data, { ...data, warrantyDays: 90, localPickUp: false }, product, rules);
    expect(update.item.sale_terms).toEqual([
      { id: "WARRANTY_TYPE", value_id: "2230280" },
      { id: "WARRANTY_TIME", value_name: "90 días" },
    ]);
    expect(update.item.shipping).toEqual({ mode: "me2", local_pick_up: false });
  });
});

describe("datos iniciales y guardados (RF-2, RF-5)", () => {
  const defaults = { listingType: "gold_special", warrantyType: "SELLER", warrantyDays: 30, localPickUp: true };

  it("arranca con el nombre, la marca del producto y los valores por defecto", () => {
    expect(initialPublicationData({ name: " Cable USB-C ", brandName: "Genérico" }, defaults)).toMatchObject({
      title: "Cable USB-C",
      attributes: [{ id: "BRAND", valueName: "Genérico" }],
      useProductPhoto: true,
      listingType: "gold_special",
      warrantyType: "SELLER",
      warrantyDays: 30,
      localPickUp: true,
    });
  });

  it("sin marca ni garantía por defecto", () => {
    const data = initialPublicationData({ name: "Cable", brandName: null }, { ...defaults, warrantyType: null });
    expect(data.attributes).toEqual([]);
    expect(data.warrantyType).toBeNull();
    expect(data.warrantyDays).toBeNull();
  });

  it("lo guardado: descarta características con otra forma y valores desconocidos", () => {
    const read = publicationDataFromRow({
      ...data,
      attributes: [{ id: "BRAND", valueName: "Genérico" }, { valueName: "sin id" }, "basura", { id: "GENDER", valueId: 7 }],
      listingType: "otra",
      warrantyType: "X",
    });
    expect(read.attributes).toEqual([
      { id: "BRAND", valueId: null, valueName: "Genérico" },
      { id: "GENDER", valueId: null, valueName: null },
    ]);
    expect(read.listingType).toBe("gold_special");
    expect(read.warrantyType).toBeNull();
  });
});
