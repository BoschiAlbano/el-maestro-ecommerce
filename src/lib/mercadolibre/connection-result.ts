// Lógica pura de la conexión con Mercado Libre (specs/019, RF-2, RF-7 y
// RF-8). Sin I/O: la usan el retorno de la autorización, la pestaña de
// Configuración y las pruebas.

/** Qué hacer con la cuenta que acaba de autorizar, según la que ya estaba. */
export type ConnectDecision = "create" | "update" | "different_account";

/**
 * Solo puede haber una cuenta (RF-7). Si la que autorizó es otra, no se
 * reemplaza: hay que desconectar primero (RF-8).
 */
export function decideConnection(existing: { mlUserId: string } | null, incomingMlUserId: string): ConnectDecision {
  if (!existing) return "create";
  return existing.mlUserId === incomingMlUserId ? "update" : "different_account";
}

/** Parámetro con el que el retorno le avisa el resultado a la pantalla. */
export const ML_RESULT_PARAM = "ml";

export const ML_RESULTS = {
  conectada: { ok: true, text: "La cuenta de Mercado Libre quedó conectada." },
  no_autorizado: { ok: false, text: "No se autorizó la conexión. Podés intentarlo de nuevo." },
  retorno_invalido: {
    ok: false,
    text: "El retorno desde Mercado Libre no es válido o ya se usó. Empezá la conexión de nuevo desde acá.",
  },
  otra_cuenta: {
    ok: false,
    text: "Autorizaste una cuenta distinta de la que está conectada. Para cambiar de cuenta, desconectá primero la actual.",
  },
  sin_renovacion: {
    ok: false,
    text: 'Mercado Libre no entregó el permiso de renovación. Hay que activar "Refresh Token" en la aplicación de Mercado Libre y volver a conectar.',
  },
  codigo_invalido: {
    ok: false,
    text: "La autorización venció antes de completarse. Empezá la conexión de nuevo.",
  },
  ml_no_responde: { ok: false, text: "Mercado Libre no responde. Probá de nuevo en unos minutos." },
  sin_permiso: { ok: false, text: "Solo el Dueño puede conectar la cuenta de Mercado Libre." },
  sin_configurar: {
    ok: false,
    text: "Falta configurar Mercado Libre en el servidor. Avisale a quien administra el sistema.",
  },
  error: { ok: false, text: "No se pudo completar la conexión. Probá de nuevo." },
} as const satisfies Record<string, { ok: boolean; text: string }>;

export type MlConnectResult = keyof typeof ML_RESULTS;

/** Lee el resultado de la dirección; cualquier valor desconocido se ignora. */
export function parseMlResult(value: string | string[] | undefined): MlConnectResult | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(ML_RESULTS, value) ? (value as MlConnectResult) : null;
}

/** A dónde vuelve el usuario después de pasar por Mercado Libre. */
export function mlResultPath(result: MlConnectResult): string {
  return `/configuracion?tab=mercadolibre&${ML_RESULT_PARAM}=${result}`;
}
