// A quién se le factura una orden de Mercado Libre (specs/024, RF-5 a RF-8).
// Pura: decide con los datos de Mercado Libre, el total y el monto que obliga a
// identificar al comprador (spec 023, RF-9).
import { IVA_CONSUMIDOR_FINAL } from "@/lib/facturacion/iva-conditions";
import { validateReceiver } from "@/lib/facturacion/invoice-policy";
import type { BuyerFiscalData } from "./billing-read";

export type ReceiverDecision =
  | { kind: "identified"; receiver: BuyerFiscalData }
  /** Sin datos completos y con un total bajo: Consumidor Final sin identificar (RF-6). */
  | { kind: "final_consumer"; receiver: BuyerFiscalData; reason: string }
  /** Sin datos completos y con un total que obliga a identificar: no se emite (RF-7). */
  | { kind: "missing"; receiver: BuyerFiscalData; reason: string };

const ANONYMOUS: Omit<BuyerFiscalData, "address"> = { docType: "NONE", docNumber: null, name: null, ivaCondition: IVA_CONSUMIDOR_FINAL };

export function decideReceiver(data: BuyerFiscalData | null, total: number, threshold: number): ReceiverDecision {
  const receiver = data ?? { ...ANONYMOUS, address: null };
  const problem = receiver.docType === "NONE" ? "Mercado Libre no informó el documento del comprador." : validateReceiver(receiver, total, threshold);
  if (!problem) return { kind: "identified", receiver };

  const anonymous: BuyerFiscalData = { ...ANONYMOUS, address: receiver.address };
  if (validateReceiver(anonymous, total, threshold) === null) {
    return { kind: "final_consumer", receiver: anonymous, reason: `${problem} Se factura a Consumidor Final.` };
  }
  return {
    kind: "missing",
    receiver,
    reason: `${problem} Por el monto, la factura tiene que llevar el nombre y el documento: cargalos a mano.`,
  };
}

/** Si el usuario cambió algo de lo que propuso el sistema (RF-8). */
export function receiverWasEdited(proposed: BuyerFiscalData, final: Omit<BuyerFiscalData, "address"> & { address?: string | null }): boolean {
  return (
    proposed.docType !== final.docType ||
    (proposed.docNumber ?? "") !== (final.docNumber ?? "") ||
    (proposed.name ?? "").trim() !== (final.name ?? "").trim() ||
    proposed.ivaCondition !== final.ivaCondition ||
    (final.address !== undefined && (proposed.address ?? "") !== (final.address ?? ""))
  );
}
