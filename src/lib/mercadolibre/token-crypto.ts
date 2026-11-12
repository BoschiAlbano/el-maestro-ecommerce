// Cifrado de la autorización de Mercado Libre (specs/019, RF-16). La lógica
// vive en `src/lib/secret-box.ts`, que también usa la facturación (specs/023);
// acá quedan los nombres con los que la usa el resto de la spec 019. La clave
// es `ML_TOKEN_ENCRYPTION_KEY`.
export {
  SecretBoxError as TokenCryptoError,
  decryptSecret as decryptToken,
  encryptSecret as encryptToken,
} from "@/lib/secret-box";
