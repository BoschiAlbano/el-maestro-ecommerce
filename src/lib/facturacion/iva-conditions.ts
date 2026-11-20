import type { ReceiverDocType } from "./documentos";

// Condición frente al IVA del comprador (specs/023, RF-8). Códigos de la tabla
// de ARCA para comprobantes clase C, confirmados contra homologación el
// 2026-11-11 (prueba técnica, A-5). ARCA exige informarla en toda factura
// (RG 5616/2024) y rechaza sin ella con el código 10246.

export type IvaCondition = { id: number; label: string };

/** Las que se ofrecen en pantalla. ARCA acepta más (exterior, no categorizado…), que no se usan en este negocio. */
export const IVA_CONDITIONS: readonly IvaCondition[] = [
  { id: 5, label: "Consumidor Final" },
  { id: 1, label: "IVA Responsable Inscripto" },
  { id: 6, label: "Responsable Monotributo" },
  { id: 13, label: "Monotributista Social" },
  { id: 4, label: "IVA Sujeto Exento" },
];

export const IVA_CONSUMIDOR_FINAL = 5;
export const IVA_RESPONSABLE_INSCRIPTO = 1;
export const IVA_MONOTRIBUTO = 6;
export const IVA_EXENTO = 4;

export function ivaConditionLabel(id: number): string {
  return IVA_CONDITIONS.find((c) => c.id === id)?.label ?? `Condición ${id}`;
}

/** Valor inicial del selector: quien no se identifica, o tiene DNI, es Consumidor Final; con CUIT, Responsable Inscripto. */
export function defaultIvaCondition(docType: ReceiverDocType): number {
  return docType === "CUIT" ? IVA_RESPONSABLE_INSCRIPTO : IVA_CONSUMIDOR_FINAL;
}

/** Sin identificar al comprador solo puede ser Consumidor Final. */
export function isIvaConditionAllowed(docType: ReceiverDocType, id: number): boolean {
  if (!IVA_CONDITIONS.some((c) => c.id === id)) return false;
  return docType === "NONE" ? id === IVA_CONSUMIDOR_FINAL : true;
}

/**
 * Lo que Mercado Libre informa como situación fiscal del comprador (spec
 * 024): «Monotributo», «IVA Responsable Inscripto» o «IVA Exento». Lo demás
 * se toma como Consumidor Final.
 */
export function ivaConditionFromMercadoLibre(description: string | null | undefined): number {
  const text = (description ?? "").toLowerCase();
  if (text.includes("monotribut")) return IVA_MONOTRIBUTO;
  if (text.includes("responsable inscripto")) return IVA_RESPONSABLE_INSCRIPTO;
  if (text.includes("exento")) return IVA_EXENTO;
  return IVA_CONSUMIDOR_FINAL;
}
