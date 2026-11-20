// Decisiones puras sobre la autorización de Mercado Libre (specs/019, RF-4 y
// RF-5): cuándo renovar y cómo leer una renovación fallida.

/** Se renueva cuando faltan 5 minutos o menos para el vencimiento. */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function shouldRefresh(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_MARGIN_MS;
}

/** Mercado Libre informa la vigencia en segundos (6 horas en la prueba técnica). */
export function expiresAtFrom(now: Date, expiresInSeconds: number): Date {
  return new Date(now.getTime() + expiresInSeconds * 1000);
}

export type RefreshFailure =
  /** El permiso ya no vale: hay que volver a conectar la cuenta. */
  | "definitive"
  /** Algo pasajero o ajeno al permiso: no se toca el estado de la conexión. */
  | "transient";

/**
 * Lee una renovación fallida. `status` es `null` cuando no hubo respuesta.
 *
 * Definitivo es solo HTTP 400 con `invalid_grant`: es lo que Mercado Libre
 * respondió al renovar con un permiso revocado (prueba técnica, P-8).
 *
 * Todo lo demás es pasajero, a propósito: una caída de Mercado Libre, el
 * límite de consultas o una clave de la aplicación mal cargada no se
 * arreglan pidiéndole al dueño que vuelva a conectar (spec, sección 7).
 */
export function classifyRefreshError(status: number | null, body: unknown): RefreshFailure {
  if (status !== 400) return "transient";
  if (typeof body !== "object" || body === null) return "transient";
  return (body as { error?: unknown }).error === "invalid_grant" ? "definitive" : "transient";
}
