import { MlConfigError } from "./errors";

// Configuración de la aplicación ante Mercado Libre (specs/019, RF-17). Vive
// en variables de entorno; nunca en la base ni en el repositorio.

export type MlConfig = {
  clientId: string;
  clientSecret: string;
  /** Tiene que ser idéntica a la cargada en la aplicación de Mercado Libre. */
  redirectUri: string;
  /** Clave para cifrar la autorización guardada: 32 bytes en base64. */
  encryptionKey: string;
};

const VARIABLES = {
  clientId: "ML_CLIENT_ID",
  clientSecret: "ML_CLIENT_SECRET",
  redirectUri: "ML_REDIRECT_URI",
  encryptionKey: "ML_TOKEN_ENCRYPTION_KEY",
} as const;

type Env = Record<string, string | undefined>;

/**
 * Falla cerrada: si falta cualquier variable, ninguna acción de Mercado Libre
 * funciona. El mensaje nombra las variables que faltan, nunca sus valores.
 */
export function readMlConfig(env: Env = process.env): MlConfig {
  const missing = Object.values(VARIABLES).filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new MlConfigError(`Falta configurar Mercado Libre en el servidor: ${missing.join(", ")}.`);
  }

  const redirectUri = env[VARIABLES.redirectUri]!.trim();
  if (!redirectUri.startsWith("https://")) {
    throw new MlConfigError(`${VARIABLES.redirectUri} tiene que empezar con https:// (lo exige Mercado Libre).`);
  }

  return {
    clientId: env[VARIABLES.clientId]!.trim(),
    clientSecret: env[VARIABLES.clientSecret]!.trim(),
    redirectUri,
    encryptionKey: env[VARIABLES.encryptionKey]!.trim(),
  };
}

/** Para mostrar u ocultar la sección sin lanzar: ¿está todo configurado? */
export function isMlConfigured(env: Env = process.env): boolean {
  try {
    readMlConfig(env);
    return true;
  } catch {
    return false;
  }
}
