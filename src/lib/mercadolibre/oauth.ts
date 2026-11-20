import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Lógica pura del inicio de la autorización con Mercado Libre (specs/019,
// RF-2): dirección de autorización, valor de control contra retornos
// falsificados y verificación adicional (PKCE).

/** Dirección de autorización del sitio de Argentina. */
export const ML_AUTHORIZATION_URL = "https://auth.mercadolibre.com.ar/authorization";

/** Cookie que guarda el valor de control y el verificador mientras el usuario está en Mercado Libre. */
export const ML_OAUTH_COOKIE = "ml_oauth";
export const ML_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export type OAuthAttempt = {
  /** Valor de control: vuelve en el retorno y tiene que coincidir. */
  state: string;
  /** Verificador de PKCE: solo lo conoce el servidor; se manda al canjear el código. */
  verifier: string;
};

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newOAuthAttempt(): OAuthAttempt {
  return {
    state: randomBytes(16).toString("hex"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  attempt: OAuthAttempt;
}): string {
  const url = new URL(ML_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.attempt.state,
    code_challenge: pkceChallenge(input.attempt.verifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** El valor de la cookie: los dos datos del intento, separados por un punto. */
export function encodeOAuthCookie(attempt: OAuthAttempt): string {
  return `${attempt.state}.${attempt.verifier}`;
}

export function decodeOAuthCookie(value: string | undefined): OAuthAttempt | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  return { state: value.slice(0, separator), verifier: value.slice(separator + 1) };
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Compara el valor de control del retorno con el guardado. Falla cerrada:
 * si falta cualquiera de los dos, no coincide. Se comparan los hashes para
 * que tengan el mismo largo (mismo criterio que `isAuthorizedCron`).
 */
export function isSameState(expected: string | undefined, received: string | null | undefined): boolean {
  if (!expected || !received) return false;
  return timingSafeEqual(sha256(expected), sha256(received));
}
