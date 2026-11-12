// Validación de los documentos que van en una factura (specs/023, RF-8 y
// RF-2c). Funciones puras: se usan en el servidor y en el formulario.

/** Deja solo los dígitos: acepta "20-11111111-2", "20.111.111" o con espacios. */
export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Valida un CUIT o CUIL: 11 dígitos, con el último como dígito verificador
 * (módulo 11). No consulta a ARCA: un CUIT bien formado puede no existir, y
 * eso lo informa ARCA al autorizar.
 */
export function isValidCuit(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length !== 11) return false;

  const sum = CUIT_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
  const remainder = sum % 11;
  // Con resto 1 el verificador sería 10, que no es un dígito: no existe ese CUIT.
  if (remainder === 1) return false;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return expected === Number(digits[10]);
}

/** Valida un DNI: 7 u 8 dígitos. */
export function isValidDni(raw: string): boolean {
  const digits = onlyDigits(raw);
  return digits.length === 7 || digits.length === 8;
}

/** "20111111112" → "20-11111111-2". Si no tiene 11 dígitos, lo devuelve como vino. */
export function formatCuit(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.length !== 11) return raw;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export type ReceiverDocType = "NONE" | "DNI" | "CUIT";

/** Devuelve el mensaje de error, o `null` si el documento es válido para su tipo. */
export function validateReceiverDocument(type: ReceiverDocType, number: string | null | undefined): string | null {
  const value = (number ?? "").trim();
  if (type === "NONE") {
    return value ? "Un comprobante a Consumidor Final sin identificar no lleva número de documento." : null;
  }
  if (!value) return "Ingresá el número de documento.";
  if (type === "DNI") {
    return isValidDni(value) ? null : "El DNI tiene que tener 7 u 8 números.";
  }
  return isValidCuit(value) ? null : "El CUIT no es válido. Revisá los 11 números.";
}
