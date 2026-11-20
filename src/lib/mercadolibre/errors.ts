// Errores de la integración con Mercado Libre (specs/019). Quien llama decide
// qué hacer según el tipo: reintentar más tarde, pedir reconexión o mostrar
// el problema. Ninguno incluye la autorización ni las claves en su mensaje.

export class MlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Falta configurar algo en las variables de entorno. */
export class MlConfigError extends MlError {}

/** Mercado Libre no respondió, o respondió con un error de su lado. Es pasajero. */
export class MlUnavailableError extends MlError {
  constructor(message = "Mercado Libre no responde. Probá de nuevo en unos minutos.") {
    super(message);
  }
}

/** Mercado Libre limitó la cantidad de consultas. Es pasajero. */
export class MlRateLimitError extends MlError {
  constructor(message = "Mercado Libre limitó las consultas. Probá de nuevo en unos minutos.") {
    super(message);
  }
}

/** No hay cuenta conectada, o el permiso dejó de valer: hay que volver a conectar. */
export class MlReconnectRequiredError extends MlError {
  constructor(message = "Hay que volver a conectar la cuenta de Mercado Libre.") {
    super(message);
  }
}

/** Mercado Libre rechazó el pedido. `body` es lo que respondió, ya sin datos sensibles. */
export class MlApiError extends MlError {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message = `Mercado Libre respondió con un error (HTTP ${status}).`,
  ) {
    super(message);
  }
}

/** La renovación de la autorización falló. Lo clasifica `classifyRefreshError`. */
export class MlTokenRequestError extends MlError {
  constructor(
    readonly status: number | null,
    readonly body: unknown,
  ) {
    super(status === null ? "No se pudo contactar a Mercado Libre." : `Mercado Libre rechazó el pedido (HTTP ${status}).`);
  }
}
