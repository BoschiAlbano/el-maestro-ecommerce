import { MlReconnectRequiredError, MlTokenRequestError, MlUnavailableError } from "./errors";
import { classifyRefreshError, expiresAtFrom, shouldRefresh } from "./token-policy";

// Única puerta para obtener la autorización vigente de la cuenta conectada
// (specs/019, RF-4 y RF-5; plan, sección 3.3). La lógica es pura: la base, el
// cifrado y la llamada a Mercado Libre entran por `deps`, para poder probar
// la renovación simultánea sin base ni red (mismo criterio que `StockTx`).

export type StoredConnection = {
  status: "CONNECTED" | "NEEDS_RECONNECT";
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessTokenExpiresAt: Date;
};

export type RenewedConnection = {
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessTokenExpiresAt: Date;
  lastRefreshedAt: Date;
};

/** La fila de la conexión, tomada con un bloqueo exclusivo. */
export type LockedConnection = {
  row: StoredConnection | null;
  saveRenewed(data: RenewedConnection): Promise<void>;
  markNeedsReconnect(reason: string): Promise<void>;
};

export type TokenManagerDeps = {
  now(): Date;
  encrypt(plain: string): string;
  decrypt(stored: string): string;
  /** Lectura sin bloqueo, para el caso común en que no hay que renovar. */
  read(): Promise<StoredConnection | null>;
  /**
   * Ejecuta `fn` con la fila bloqueada, de a uno por vez. Lo que `fn` guarde
   * se confirma cuando `fn` termina sin lanzar.
   */
  withLock<T>(fn: (locked: LockedConnection) => Promise<T>): Promise<T>;
  /** Pide la renovación a Mercado Libre. Lanza `MlTokenRequestError` si falla. */
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
  /** Avisa que hay que volver a conectar. Se llama fuera del bloqueo. */
  onReconnectRequired(): Promise<void>;
};

export type GetTokenOptions = {
  /**
   * La autorización que Mercado Libre acaba de rechazar. Fuerza la
   * renovación aunque no esté vencida, salvo que otro ya la haya renovado.
   */
  rejectedToken?: string;
};

export const RECONNECT_REASON = "Mercado Libre rechazó la renovación: el permiso fue revocado o venció.";

type Outcome = { kind: "ok"; token: string } | { kind: "reconnect"; notify: boolean } | { kind: "unavailable" };

export async function getValidAccessToken(deps: TokenManagerDeps, options: GetTokenOptions = {}): Promise<string> {
  const { rejectedToken } = options;

  const row = await deps.read();
  if (!row || row.status !== "CONNECTED") throw new MlReconnectRequiredError();
  if (!rejectedToken && !shouldRefresh(row.accessTokenExpiresAt, deps.now())) {
    return deps.decrypt(row.accessTokenEnc);
  }

  // El resultado se devuelve en vez de lanzar dentro del bloqueo: lanzar
  // desharía lo guardado, y "requiere reconexión" tiene que quedar guardado.
  const outcome = await deps.withLock<Outcome>(async (locked) => {
    if (!locked.row || locked.row.status !== "CONNECTED") return { kind: "reconnect", notify: false };

    const now = deps.now();
    const current = deps.decrypt(locked.row.accessTokenEnc);

    // Ya con el bloqueo, se vuelve a mirar: si otro renovó mientras se
    // esperaba, se usa ese resultado y no se llama a Mercado Libre.
    const stillNeeded = rejectedToken
      ? current === rejectedToken
      : shouldRefresh(locked.row.accessTokenExpiresAt, now);
    if (!stillNeeded) return { kind: "ok", token: current };

    try {
      const renewed = await deps.refresh(deps.decrypt(locked.row.refreshTokenEnc));
      await locked.saveRenewed({
        accessTokenEnc: deps.encrypt(renewed.accessToken),
        // Mercado Libre entrega una credencial de renovación nueva en cada
        // renovación; si alguna vez no viniera, se conserva la que había.
        refreshTokenEnc: renewed.refreshToken ? deps.encrypt(renewed.refreshToken) : locked.row.refreshTokenEnc,
        accessTokenExpiresAt: expiresAtFrom(now, renewed.expiresIn),
        lastRefreshedAt: now,
      });
      return { kind: "ok", token: renewed.accessToken };
    } catch (error) {
      if (!(error instanceof MlTokenRequestError)) throw error;

      if (classifyRefreshError(error.status, error.body) === "definitive") {
        await locked.markNeedsReconnect(RECONNECT_REASON);
        return { kind: "reconnect", notify: true };
      }

      // Falla pasajera. Si la autorización todavía no venció y nadie la
      // rechazó, sirve unos minutos más: se usa en vez de fallar.
      const stillValid = !rejectedToken && locked.row.accessTokenExpiresAt.getTime() > now.getTime();
      return stillValid ? { kind: "ok", token: current } : { kind: "unavailable" };
    }
  });

  switch (outcome.kind) {
    case "ok":
      return outcome.token;
    case "unavailable":
      throw new MlUnavailableError();
    case "reconnect":
      if (outcome.notify) await deps.onReconnectRequired();
      throw new MlReconnectRequiredError();
  }
}
