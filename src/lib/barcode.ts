/**
 * Códigos de barras propios (specs/004, sección 10): EAN-13 con prefijo
 * 20-29, el rango que GS1 reserva para uso interno de un comercio — nunca
 * lo usa un fabricante real, así que no puede chocar con un código de
 * origen (ver `spec.md`, sección 7).
 *
 * Lógica pura acá (testeable sin base); `generateUniqueBarcode`, al final,
 * es la única parte que toca la base para revisar colisiones.
 */

/** Dígito verificador EAN-13 a partir de los primeros 12 dígitos. */
export function computeEAN13CheckDigit(digits12: string): number {
  if (!/^\d{12}$/.test(digits12)) {
    throw new Error("Se esperan 12 dígitos para calcular el verificador EAN-13.");
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i]);
    // Posición 1-indexada desde la izquierda: impares peso 1, pares peso 3.
    const weight = (i + 1) % 2 === 1 ? 1 : 3;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** Un candidato de código EAN-13 propio: prefijo 20-29 + 9 dígitos al azar + verificador. */
export function generateBarcodeCandidate(): string {
  const prefix = String(20 + Math.floor(Math.random() * 10)); // "20".."29"
  let body = "";
  for (let i = 0; i < 10; i++) {
    body += Math.floor(Math.random() * 10);
  }
  const digits12 = prefix + body;
  const checkDigit = computeEAN13CheckDigit(digits12);
  return digits12 + String(checkDigit);
}

/** true si `code` tiene forma de código propio válido (prefijo 20-29, 13 dígitos, verificador correcto). */
export function isValidOwnBarcode(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const prefix = Number(code.slice(0, 2));
  if (prefix < 20 || prefix > 29) return false;
  return computeEAN13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

type BarcodeLookup = {
  product: { findUnique: (args: { where: { barcode: string } } ) => Promise<unknown> };
};

/** Genera un código propio que no choca con ninguno existente (reintenta ante colisión). */
export async function generateUniqueBarcode(db: BarcodeLookup, maxAttempts = 20): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateBarcodeCandidate();
    const existing = await db.product.findUnique({ where: { barcode: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("No se pudo generar un código de barras único, probá de nuevo.");
}
