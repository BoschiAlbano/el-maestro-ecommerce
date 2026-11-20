// Estado de una publicación como lo muestra el sistema (specs/020, RF-12), a
// partir de lo que informa Mercado Libre. Pura: sin I/O.
// Desde "enums" y no desde "client", para no arrastrar el runtime de Prisma.
import type { MlListingStatus } from "@/generated/prisma/enums";

export type MappedStatus = {
  status: MlListingStatus;
  /** Motivo en español, cuando lo puso Mercado Libre. `null` si fue el vendedor. */
  reason: string | null;
  /** La pausa, la observación o la baja la decidió Mercado Libre, no el vendedor. */
  imposedByMercadoLibre: boolean;
};

/** Subestados que puso el vendedor o que son esperables: no llevan motivo ni aviso. */
const SELLER_SUB_STATUSES = new Set(["paused_by_seller", "paused_by_user", "out_of_stock"]);

/** Subestados conocidos de Mercado Libre, en español. */
const REASONS: Record<string, string> = {
  out_of_stock: "Sin unidades disponibles.",
  waiting_for_patch: "Mercado Libre pide corregir la publicación.",
  pending_documentation: "Mercado Libre pide documentación.",
  forbidden: "Mercado Libre la dio de baja por no cumplir sus políticas.",
  held: "Mercado Libre la retuvo para revisarla.",
  freezed: "Mercado Libre la congeló para revisarla.",
  suspended: "Mercado Libre la suspendió.",
  expired: "La publicación venció.",
  deleted: "La publicación fue eliminada.",
  picture_download_pending: "Mercado Libre está procesando las fotos.",
};

export const STATUS_LABELS: Record<MlListingStatus, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  PAUSED_NO_STOCK: "Pausada sin stock",
  UNDER_REVIEW: "Observada por Mercado Libre",
  CLOSED: "Finalizada",
};

function reasonFor(subStatus: string[]): string | null {
  const imposed = subStatus.filter((s) => !SELLER_SUB_STATUSES.has(s));
  if (imposed.length === 0) return null;
  return imposed.map((s) => REASONS[s] ?? `Motivo informado por Mercado Libre: ${s}.`).join(" ");
}

export function mapListingStatus(mlStatus: string, subStatus: string[]): MappedStatus {
  const reason = reasonFor(subStatus);
  switch (mlStatus) {
    case "active":
      return { status: "ACTIVE", reason: null, imposedByMercadoLibre: false };
    case "paused":
      // Pausada por el vendedor y además en 0 unidades: manda la pausa del
      // vendedor, porque al volver el stock sigue pausada (prueba técnica 021).
      if (subStatus.includes("out_of_stock") && reason === null && !subStatus.includes("paused_by_seller")) {
        return { status: "PAUSED_NO_STOCK", reason: REASONS.out_of_stock, imposedByMercadoLibre: false };
      }
      return { status: "PAUSED", reason, imposedByMercadoLibre: reason !== null };
    case "under_review":
    case "inactive":
      return {
        status: "UNDER_REVIEW",
        reason: reason ?? "Mercado Libre la está revisando.",
        imposedByMercadoLibre: true,
      };
    case "closed":
      return { status: "CLOSED", reason, imposedByMercadoLibre: reason !== null };
    default:
      return {
        status: "UNDER_REVIEW",
        reason: `Estado que el sistema no conoce, informado por Mercado Libre: ${mlStatus}.`,
        imposedByMercadoLibre: true,
      };
  }
}

/** «Observada por Mercado Libre» → «observada por Mercado Libre». */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Lo que hizo el vendedor desde Mercado Libre, sin motivo de Mercado Libre. */
const SELLER_CHANGE: Partial<Record<MlListingStatus, string>> = {
  ACTIVE: "Se reactivó desde Mercado Libre.",
  PAUSED: "Se pausó desde Mercado Libre.",
  CLOSED: "Se finalizó desde Mercado Libre.",
};

/**
 * Frase para la campanita cuando el estado cambió en Mercado Libre (RF-14,
 * cambio 2026-11-16: todo cambio avisa). `null` si no cambió, o si el cambio
 * es hacia o desde «pausada sin stock»: esos los provoca el propio sistema al
 * cambiar la cantidad (spec 021) y llenarían la campanita.
 */
export function statusChangeNote(previous: MlListingStatus, next: MappedStatus): string | null {
  if (previous === next.status) return null;
  if (previous === "PAUSED_NO_STOCK" || next.status === "PAUSED_NO_STOCK") return null;
  const sellerChange = SELLER_CHANGE[next.status];
  if (!next.imposedByMercadoLibre && sellerChange) return sellerChange;
  const label = lowerFirst(STATUS_LABELS[next.status]);
  return `Quedó ${label}${next.reason ? `: ${next.reason}` : "."}`;
}
