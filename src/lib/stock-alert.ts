// Aviso de stock bajo (specs/013): se puede marcar como leído, y vuelve a
// aparecer solo si algún producto *nuevo* queda por debajo del mínimo. Funciones
// puras; el estado (qué productos estaban bajo al marcarlo) se guarda en `Setting`.

/** Los productos bajo el mínimo que ya estaban cuando se marcó leído y siguen estándolo. */
export function stillDismissed(currentIds: string[], dismissedIds: string[]): string[] {
  const current = new Set(currentIds);
  return dismissedIds.filter((id) => current.has(id));
}

/**
 * El aviso se muestra si hay algún producto bajo el mínimo que no estaba en los
 * que se marcaron como leídos. Si todos siguen siendo los mismos, queda oculto.
 */
export function isStockAlertActive(currentIds: string[], dismissedIds: string[]): boolean {
  const dismissed = new Set(dismissedIds);
  return currentIds.some((id) => !dismissed.has(id));
}
