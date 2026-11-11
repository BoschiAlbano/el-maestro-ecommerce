import type { z } from "zod";
import { MlApiError, MlRateLimitError, MlUnavailableError } from "./errors";
import type { MlHttpMethod, MlHttpOptions, MlHttpResponse } from "./http";
import type { GetTokenOptions } from "./token-manager";

// Consultas a Mercado Libre en nombre de la cuenta conectada (specs/019, plan
// sección 3.1). Pone la autorización, reintenta una vez si Mercado Libre la
// rechaza, traduce los errores a tipos y valida la respuesta. La lógica es
// pura; `client.ts` la arma con la base y la red reales.

export type MlFetchDeps = {
  getToken(options?: GetTokenOptions): Promise<string>;
  http(method: MlHttpMethod, path: string, options?: MlHttpOptions): Promise<MlHttpResponse>;
};

export type MlFetchOptions<T> = {
  method?: MlHttpMethod;
  json?: unknown;
  /** Forma esperada de la respuesta. Lo que no la cumple no se usa. */
  schema: z.ZodType<T>;
};

export function createMlFetch(deps: MlFetchDeps) {
  return async function mlFetch<T>(path: string, options: MlFetchOptions<T>): Promise<T> {
    const method = options.method ?? "GET";

    let token = await deps.getToken();
    let response = await deps.http(method, path, { token, json: options.json });

    // Autorización rechazada antes de su vencimiento (por ejemplo, permiso
    // revocado): se fuerza la renovación y se reintenta una sola vez. Si el
    // permiso ya no vale, `getToken` lanza `MlReconnectRequiredError`.
    if (response.status === 401) {
      token = await deps.getToken({ rejectedToken: token });
      response = await deps.http(method, path, { token, json: options.json });
    }

    if (response.status === 429) throw new MlRateLimitError();
    if (response.status >= 500) throw new MlUnavailableError();
    if (response.status < 200 || response.status >= 300) throw new MlApiError(response.status, response.body);

    const parsed = options.schema.safeParse(response.body);
    if (!parsed.success) {
      throw new MlApiError(response.status, response.body, "Mercado Libre respondió algo que el sistema no esperaba.");
    }
    return parsed.data;
  };
}
