import "server-only";
import { mlHttp } from "./http";
import { createMlFetch } from "./ml-fetch";
import { getValidAccessToken } from "./tokens";

/**
 * Consulta a Mercado Libre en nombre de la cuenta conectada (specs/019).
 * Es la forma de llamar a la API desde el resto del sistema:
 *
 *   const cuenta = await mlFetch("/users/me", { schema: accountSchema });
 */
export const mlFetch = createMlFetch({ getToken: getValidAccessToken, http: mlHttp });
