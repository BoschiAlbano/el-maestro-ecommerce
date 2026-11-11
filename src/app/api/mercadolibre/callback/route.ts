import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { isOwner } from "@/lib/permissions";
import { readMlConfig } from "@/lib/mercadolibre/config";
import { saveMlConnection } from "@/lib/mercadolibre/connection";
import { mlResultPath, type MlConnectResult } from "@/lib/mercadolibre/connection-result";
import { MlConfigError, MlTokenRequestError, MlUnavailableError } from "@/lib/mercadolibre/errors";
import { exchangeCode, mlHttp } from "@/lib/mercadolibre/http";
import { ML_OAUTH_COOKIE, decodeOAuthCookie, isSameState } from "@/lib/mercadolibre/oauth";

// Retorno desde Mercado Libre después de autorizar (specs/019, RF-2; plan,
// sección 3.2). Nunca se cachea y nunca devuelve la autorización: siempre
// termina en una redirección a Configuración con un código de resultado.
export const dynamic = "force-dynamic";

const accountSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  nickname: z.string().min(1),
  site_id: z.string().min(1),
});

async function completeConnection(request: NextRequest): Promise<MlConnectResult> {
  // Constitución, regla 14: sesión y permiso antes que nada. Solo el Dueño conecta.
  const currentUser = await getCurrentUser();
  if (!currentUser || !isOwner(currentUser)) return "sin_permiso";

  // La cookie del intento se borra siempre: un retorno no se puede reutilizar.
  const cookieStore = await cookies();
  const attempt = decodeOAuthCookie(cookieStore.get(ML_OAUTH_COOKIE)?.value);
  cookieStore.delete({ name: ML_OAUTH_COOKIE, path: "/api/mercadolibre/callback" });

  const params = request.nextUrl.searchParams;
  // Mercado Libre vuelve con `error` cuando el usuario toca "Por ahora no".
  if (params.get("error")) return "no_autorizado";

  const code = params.get("code");
  if (!code || !attempt || !isSameState(attempt.state, params.get("state"))) return "retorno_invalido";

  try {
    const config = readMlConfig();
    const authorization = await exchangeCode(config, { code, verifier: attempt.verifier });

    // Sin credencial de renovación la conexión se caería a las 6 horas: no
    // se guarda una conexión que va a fallar (prueba técnica, P-1).
    const { refreshToken } = authorization;
    if (!refreshToken) return "sin_renovacion";

    const accountResponse = await mlHttp("GET", "/users/me", { token: authorization.accessToken });
    const account = accountSchema.safeParse(accountResponse.body);
    if (accountResponse.status !== 200 || !account.success) return "ml_no_responde";

    const saved = await saveMlConnection({
      userId: currentUser.id,
      account: { mlUserId: account.data.id, nickname: account.data.nickname, siteId: account.data.site_id },
      authorization: { ...authorization, refreshToken },
    });
    return saved === "saved" ? "conectada" : "otra_cuenta";
  } catch (error) {
    if (error instanceof MlConfigError) return "sin_configurar";
    if (error instanceof MlUnavailableError) return "ml_no_responde";
    if (error instanceof MlTokenRequestError) {
      // Sin respuesta o error del lado de Mercado Libre: pasajero. Un 4xx al
      // canjear es un código vencido o ya usado.
      return error.status === null || error.status >= 500 ? "ml_no_responde" : "codigo_invalido";
    }
    // Sin detalles del pedido: la dirección trae el código de autorización.
    console.error("[mercadolibre] falló el retorno de la autorización:", error instanceof Error ? error.name : "error");
    return "error";
  }
}

export async function GET(request: NextRequest) {
  const result = await completeConnection(request);
  // Fuera de cualquier try: `redirect` funciona lanzando. La dirección es
  // relativa para volver al mismo dominio por el que entró el usuario.
  redirect(mlResultPath(result));
}
