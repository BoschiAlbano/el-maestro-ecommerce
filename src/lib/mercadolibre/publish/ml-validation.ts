// Las respuestas de Mercado Libre al revisar o crear una publicación,
// traducidas a errores y advertencias en español (specs/025, RF-6 y RF-8).
// Pura.

/** Una causa de `/items/validate` o de un rechazo de `POST /items`. */
export type MlCause = { type?: string; code?: string; message?: string; references?: string[] };

export type ReviewResult = {
  /** Frenan la publicación. */
  errors: string[];
  /** Se muestran sin frenar. */
  warnings: string[];
};

/**
 * Advertencias que no dicen nada útil para este negocio: el modo de envío
 * `me1` no se usa (se publica con Mercado Envíos, `me2`).
 */
const IGNORED_CODES = new Set(["shipping.lost_me1_by_user"]);

/** Mensajes propios para los códigos que Mercado Libre responde en inglés. */
const KNOWN_CODES: Record<string, string> = {
  "shipping.free_shipping.cost_exceeded":
    "El envío gratis le costaría al vendedor más que el precio de venta. Revisá el precio o las medidas del paquete.",
  "item.shipping.mandatory_free_shipping":
    "Por el precio, Mercado Libre agrega envío gratis: lo que te cuesta figura en la estimación.",
  "item.title.length.invalid": "El título es más largo de lo que admite la categoría.",
  "item.price.invalid": "El precio no es válido para esta categoría.",
  "item.pictures.invalid": "Alguna foto no cumple los requisitos de Mercado Libre (formato o tamaño mínimo de 500 px).",
  "item.category_id.invalid": "La categoría elegida no admite publicaciones: elegí otra.",
  "seller.unable_to_list": "La cuenta de Mercado Libre no puede publicar por ahora: revisá si tiene datos pendientes en Mercado Libre.",
};

/** ¿Ya viene en español? Mercado Libre responde en español las de las características. */
function looksSpanish(message: string): boolean {
  return /[áéíóúñ¿¡]|\b(el|la|los|las|es|no|está|falta|obligatorio|campo)\b/i.test(message);
}

function describe(cause: MlCause, names: Readonly<Record<string, string>>): string {
  const message = (cause.message ?? "").trim();
  if (cause.code && KNOWN_CODES[cause.code]) return KNOWN_CODES[cause.code];
  if (cause.code === "item.attributes.missing_required") {
    // «The attributes [BRAND] are required…»: se nombran como en el formulario.
    const ids = /\[([^\]]+)\]/.exec(message)?.[1]?.split(",").map((id) => id.trim()) ?? [];
    if (ids.length > 0) return `Faltan características obligatorias: ${ids.map((id) => `«${names[id] ?? id}»`).join(", ")}.`;
  }
  if (message && looksSpanish(message)) return message;
  return message ? `Mercado Libre: ${message}${cause.code ? ` (${cause.code})` : ""}` : `Mercado Libre rechazó la publicación${cause.code ? ` (${cause.code})` : ""}.`;
}

/**
 * Clasifica las causas. Lo que decide es el tipo de cada una: Mercado Libre
 * responde 400 aunque solo haya advertencias (prueba técnica, T-002).
 * `names`: los nombres de las características de la categoría, por id.
 */
export function classifyCauses(causes: readonly MlCause[], names: Readonly<Record<string, string>> = {}): ReviewResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Mercado Libre avisa dos veces una característica obligatoria que falta: como advertencia en
  // español y como error. Con el error alcanza (ya nombra la característica).
  const missingRequired = causes.some((c) => c.code === "item.attributes.missing_required");
  for (const cause of causes) {
    if (cause.code && IGNORED_CODES.has(cause.code)) continue;
    if (missingRequired && cause.code === "item.attribute.missing_catalog_required") continue;
    const text = describe(cause, names);
    const target = cause.type === "warning" ? warnings : errors;
    if (!target.includes(text)) target.push(text);
  }
  return { errors, warnings };
}

/** Las causas de la respuesta de Mercado Libre, sea cual sea su forma. */
export function causesOf(body: unknown): MlCause[] {
  if (!body || typeof body !== "object") return [];
  const cause = (body as { cause?: unknown }).cause;
  if (Array.isArray(cause)) return cause.filter((c): c is MlCause => Boolean(c) && typeof c === "object");
  const message = (body as { message?: unknown }).message;
  return typeof message === "string" ? [{ type: "error", message }] : [];
}
