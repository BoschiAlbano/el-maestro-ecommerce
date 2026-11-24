// Las características de una categoría de Mercado Libre convertidas en los
// campos del formulario de publicación (specs/025, RF-2; plan sección 3.1).
// Pura: recibe la respuesta de `GET /categories/{id}/attributes`.

/** Lo que usa el sistema de cada característica de `/categories/{id}/attributes`. */
export type MlCategoryAttribute = {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, boolean | undefined>;
  values?: { id: string; name: string }[];
  allowed_units?: { id: string; name: string }[];
  default_unit?: string;
  value_max_length?: number;
  hint?: string;
  tooltip?: string;
  relevance?: number;
};

export type FieldType = "list" | "text" | "number" | "number_unit" | "boolean";

/**
 * - `required`: Mercado Libre no publica sin ella (`required` o `catalog_required`).
 * - `conditional`: la pide según el producto (`conditional_required`); se muestra y decide la revisión previa.
 * - `recommended`: opcional y de las más relevantes de la categoría.
 * - `other`: opcional, en «Más características».
 */
export type FieldGroup = "required" | "conditional" | "recommended" | "other";

export type CategoryField = {
  id: string;
  name: string;
  type: FieldType;
  group: FieldGroup;
  /** Valores de Mercado Libre. En un texto son sugerencias: se puede escribir otro. */
  options: { id: string; name: string }[];
  units: { id: string; name: string }[];
  defaultUnit: string | null;
  maxLength: number | null;
  hint: string | null;
};

/** Una característica cargada, como se guarda y como se manda a Mercado Libre. */
export type AttributeValue = { id: string; valueId?: string | null; valueName?: string | null };

/**
 * Las que arma el sistema y no van en el formulario: SKU (spec 020), código
 * universal (RF-2, regla propia) y medidas del paquete (campos propios).
 */
const BUILT_BY_SYSTEM = new Set([
  "SELLER_SKU",
  "GTIN",
  "EMPTY_GTIN_REASON",
  "SELLER_PACKAGE_HEIGHT",
  "SELLER_PACKAGE_WIDTH",
  "SELLER_PACKAGE_LENGTH",
  "SELLER_PACKAGE_WEIGHT",
  "ITEM_CONDITION",
]);

const TYPES: Record<string, FieldType> = {
  list: "list",
  string: "text",
  number: "number",
  number_unit: "number_unit",
  boolean: "boolean",
};

const GROUP_ORDER: Record<FieldGroup, number> = { required: 0, conditional: 1, recommended: 2, other: 3 };

/** Los campos del formulario, en orden: obligatorias, condicionales, recomendadas y el resto. */
export function categoryFields(attributes: readonly MlCategoryAttribute[]): CategoryField[] {
  const fields = attributes.flatMap((attribute): CategoryField[] => {
    const tags = attribute.tags ?? {};
    const type = TYPES[attribute.value_type];
    // Ocultas, de solo lectura, fotos y las que arma el sistema no se cargan a mano.
    if (!type || tags.hidden || tags.read_only || BUILT_BY_SYSTEM.has(attribute.id)) return [];
    const group: FieldGroup =
      tags.required || tags.catalog_required
        ? "required"
        : tags.conditional_required
          ? "conditional"
          : (attribute.relevance ?? 2) === 1
            ? "recommended"
            : "other";
    return [
      {
        id: attribute.id,
        name: attribute.name,
        type,
        group,
        options: (attribute.values ?? []).map((v) => ({ id: v.id, name: v.name })),
        units: (attribute.allowed_units ?? []).map((u) => ({ id: u.id, name: u.name })),
        defaultUnit: attribute.default_unit ?? attribute.allowed_units?.[0]?.id ?? null,
        maxLength: attribute.value_max_length ?? null,
        hint: attribute.hint ?? attribute.tooltip ?? null,
      },
    ];
  });
  // `sort` es estable: dentro de cada grupo queda el orden de Mercado Libre.
  return fields.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group]);
}

/** Si la categoría pide el código universal o el motivo por el que no hay (RF-2). */
export function categoryAsksGtin(attributes: readonly MlCategoryAttribute[]): { gtin: boolean; required: boolean } {
  const gtin = attributes.find((a) => a.id === "GTIN");
  if (!gtin) return { gtin: false, required: false };
  return { gtin: true, required: Boolean(gtin.tags?.required || gtin.tags?.catalog_required) };
}

/** Los motivos que acepta la categoría para publicar sin código universal. */
export function emptyGtinReasons(attributes: readonly MlCategoryAttribute[]): { id: string; name: string }[] {
  return attributes.find((a) => a.id === "EMPTY_GTIN_REASON")?.values?.map((v) => ({ id: v.id, name: v.name })) ?? [];
}

/** ¿Tiene valor la característica? Un texto en blanco no cuenta. */
export function hasValue(value: AttributeValue | undefined): boolean {
  return Boolean(value && ((value.valueId ?? "").trim() || (value.valueName ?? "").trim()));
}

/**
 * Al cambiar de categoría se conservan las características que la nueva
 * también tiene (plan, sección 3.2).
 */
export function keepForCategory(saved: readonly AttributeValue[], fields: readonly CategoryField[]): AttributeValue[] {
  const ids = new Set(fields.map((f) => f.id));
  return saved.filter((value) => ids.has(value.id));
}

/**
 * Completa con lo que deduce Mercado Libre al sugerir la categoría (por
 * ejemplo, los conectores de un cable), sin pisar lo que ya cargó el usuario.
 */
export function prefillFromSuggestion(
  saved: readonly AttributeValue[],
  suggested: readonly { id: string; value_id?: string | null; value_name?: string | null }[],
): AttributeValue[] {
  const result = [...saved];
  for (const s of suggested) {
    if (result.some((v) => v.id === s.id && hasValue(v))) continue;
    const value = { id: s.id, valueId: s.value_id ?? null, valueName: s.value_name ?? null };
    const index = result.findIndex((v) => v.id === s.id);
    if (index >= 0) result[index] = value;
    else result.push(value);
  }
  return result;
}
