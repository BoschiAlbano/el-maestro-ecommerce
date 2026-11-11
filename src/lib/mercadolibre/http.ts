import { z } from "zod";
import type { MlConfig } from "./config";
import { MlTokenRequestError, MlUnavailableError } from "./errors";

// Llamadas de bajo nivel a Mercado Libre (specs/019). Sin SDK: el oficial
// está abandonado (docs/investigacion/2026-11-10-tecnologias.md, sección 2).
// Este módulo no sabe nada de la cuenta conectada ni de la base: recibe la
// autorización ya resuelta. Nunca registra ni devuelve autorizaciones en
// mensajes de error.

const ML_API_URL = "https://api.mercadolibre.com";
/** Mercado Libre suele responder en menos de un segundo; más que esto es una caída. */
const TIMEOUT_MS = 10_000;

export type MlHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type MlHttpOptions = {
  /** Autorización de la cuenta conectada o permiso propio de la aplicación. */
  token?: string;
  /** Cuerpo como formulario (lo usa el pedido de autorización). */
  form?: Record<string, string>;
  /** Cuerpo como JSON. */
  json?: unknown;
};

export type MlHttpResponse = { status: number; body: unknown };

/**
 * Hace el pedido y devuelve código y cuerpo, sin interpretar. Lanza
 * `MlUnavailableError` solo cuando no hubo respuesta (red caída o demora).
 */
export async function mlHttp(method: MlHttpMethod, path: string, options: MlHttpOptions = {}): Promise<MlHttpResponse> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body: string | undefined;

  if (options.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  } else if (options.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.json);
  }
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${ML_API_URL}${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new MlUnavailableError();
  }

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // No era JSON: se deja el texto tal cual.
  }
  return { status: response.status, body: parsed };
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  user_id: z.union([z.number(), z.string()]).transform(String),
  refresh_token: z.string().min(1).optional(),
});

export type MlAuthorization = {
  accessToken: string;
  /** Solo viene si la aplicación tiene activado el flujo "Refresh Token". */
  refreshToken?: string;
  /** Vigencia en segundos. */
  expiresIn: number;
  mlUserId: string;
};

type HttpFn = typeof mlHttp;

async function requestToken(config: MlConfig, form: Record<string, string>, http: HttpFn): Promise<MlAuthorization> {
  let response: MlHttpResponse;
  try {
    response = await http("POST", "/oauth/token", {
      form: { client_id: config.clientId, client_secret: config.clientSecret, ...form },
    });
  } catch {
    throw new MlTokenRequestError(null, undefined);
  }

  if (response.status !== 200) throw new MlTokenRequestError(response.status, response.body);

  const parsed = tokenResponseSchema.safeParse(response.body);
  // No se adjunta el cuerpo: una respuesta correcta trae la autorización.
  if (!parsed.success) throw new MlTokenRequestError(response.status, undefined);

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expires_in,
    mlUserId: parsed.data.user_id,
  };
}

/** Canjea el código que vuelve de Mercado Libre por la autorización de la cuenta. */
export function exchangeCode(
  config: MlConfig,
  input: { code: string; verifier: string },
  http: HttpFn = mlHttp,
): Promise<MlAuthorization> {
  return requestToken(
    config,
    {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      code_verifier: input.verifier,
    },
    http,
  );
}

/** Renueva la autorización de la cuenta conectada. */
export function refreshAuthorization(
  config: MlConfig,
  refreshToken: string,
  http: HttpFn = mlHttp,
): Promise<MlAuthorization> {
  return requestToken(config, { grant_type: "refresh_token", refresh_token: refreshToken }, http);
}

/**
 * Permiso propio de la aplicación, sin usuario: actúa en nombre de la cuenta
 * dueña de la aplicación. Hace falta para consultar los avisos perdidos, que
 * la cuenta conectada no puede ver si no es la dueña (prueba técnica, P-6).
 */
export function requestAppAuthorization(config: MlConfig, http: HttpFn = mlHttp): Promise<MlAuthorization> {
  return requestToken(config, { grant_type: "client_credentials" }, http);
}
