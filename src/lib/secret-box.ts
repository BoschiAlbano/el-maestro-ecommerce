import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado de secretos antes de guardarlos en la base: la autorización de
// Mercado Libre (specs/019, RF-16) y la clave privada del certificado de ARCA
// y su permiso temporal (specs/023, RF-2e). AES-256-GCM: además de cifrar,
// detecta si el texto guardado fue alterado.
//
// Cada uso tiene su propia clave, en una variable de entorno: quien obtuviera
// solo la base no puede leer nada.
//
// Formato guardado: `v1.<iv>.<tag>.<cifrado>`, cada parte en base64url. El
// prefijo de versión permite cambiar de clave o de algoritmo más adelante sin
// romper lo ya guardado.

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

/** La clave son 32 bytes en base64. */
function parseKey(keyBase64: string | undefined): Buffer {
  if (!keyBase64) {
    throw new SecretBoxError("Falta la clave de cifrado en el servidor.");
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new SecretBoxError("La clave de cifrado tiene que ser de 32 bytes en base64.");
  }
  return key;
}

export function encryptSecret(plain: string, keyBase64: string | undefined): string {
  const key = parseKey(keyBase64);
  // Un IV nuevo por cada cifrado: el mismo texto nunca da el mismo resultado.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, keyBase64: string | undefined): string {
  const key = parseKey(keyBase64);
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretBoxError("El dato guardado no tiene el formato esperado.");
  }
  const [, ivPart, tagPart, encryptedPart] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    // Clave equivocada o dato alterado: GCM no distingue, y no hace falta.
    // El mensaje no incluye nada del contenido.
    throw new SecretBoxError("No se pudo descifrar el dato: la clave no coincide o el dato fue alterado.");
  }
}
