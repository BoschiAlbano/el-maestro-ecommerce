import { ArcaError } from "./gateway";

// Garantiza que haya un permiso de ARCA guardado antes de usarlo (specs/023,
// plan sección 3.3b). Pedirlo es una operación con bloqueo: dos procesos que
// lo piden a la vez chocan, porque ARCA entrega uno solo.

export type EnsureTicketDeps = {
  /** ¿Hay un permiso vigente guardado? */
  hasValidTicket(): Promise<boolean>;
  /** Ejecuta `fn` de a un proceso por vez (en la base, con `SELECT … FOR UPDATE`). */
  withLock<T>(fn: () => Promise<T>): Promise<T>;
  /** Una llamada autenticada barata: hace que la biblioteca pida el permiso y lo guarde. */
  acquire(): Promise<void>;
};

/**
 * Devuelve `"existing"` si ya había un permiso, o `"acquired"` si hubo que
 * pedirlo. Lanza `ArcaError` si ARCA no lo entrega, o si lo entregó pero no
 * quedó guardado: un permiso que no se guardó es un permiso perdido.
 */
export async function ensureTicket(deps: EnsureTicketDeps): Promise<"existing" | "acquired"> {
  if (await deps.hasValidTicket()) return "existing";

  return deps.withLock(async () => {
    // Mientras se esperaba el bloqueo, otro proceso pudo haberlo guardado.
    if (await deps.hasValidTicket()) return "existing";

    await deps.acquire();

    if (!(await deps.hasValidTicket())) {
      throw new ArcaError(
        "ARCA entregó el permiso pero el sistema no lo pudo guardar. Hasta que venza no se podrá pedir otro: avisale a quien administra el sistema.",
        "storage",
      );
    }
    return "acquired";
  });
}
