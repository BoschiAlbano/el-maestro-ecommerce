"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, PackageCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { BuyerFiscalData } from "@/lib/mercadolibre/orders/billing-read";
import type { InvoiceDraft, PrepareResult } from "@/lib/mercadolibre/orders/order-invoice";
import { INVOICE_STATE_LABELS, type OrderInvoiceState } from "@/lib/mercadolibre/orders/invoice-state";
import { buildInvoiceRequest, type InvoiceForm } from "@/lib/facturacion/invoice-form";
import { requiresIdentification } from "@/lib/facturacion/invoice-policy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceBlock } from "../../ventas/invoice-block";
import { loadInvoiceDraftAction, prepareShipmentAction } from "../actions";
import { InvoicePrintButtons } from "./invoice-buttons";
import { LabelButtons } from "./label-buttons";

type Phase =
  | { kind: "loading" }
  | { kind: "blocked"; reason: string }
  | { kind: "form"; draft: Extract<InvoiceDraft, { kind: "draft" }> }
  | { kind: "done"; state: OrderInvoiceState; message: string | null };

function formFrom(receiver: BuyerFiscalData): InvoiceForm {
  return {
    enabled: true,
    identify: receiver.docType !== "NONE",
    docType: receiver.docType === "CUIT" ? "CUIT" : "DNI",
    docNumber: receiver.docNumber ?? "",
    name: receiver.name ?? "",
    ivaCondition: receiver.ivaCondition,
  };
}

function money(value: number) {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

/**
 * «Preparar envío» (specs/024, RF-1 a RF-18): muestra los datos del comprador
 * que informó Mercado Libre para confirmarlos o corregirlos, emite la factura,
 * la sube a la compra y deja las dos impresiones.
 */
export function PrepareShipmentDialog({
  orderId,
  hasLabel,
  mode = "prepare",
}: {
  orderId: string;
  hasLabel: boolean;
  /** `invoice`: «Facturar» una orden que ya salió sin factura (cambio 2026-11-24, RF-1b). */
  mode?: "prepare" | "invoice";
}) {
  const invoiceOnly = mode === "invoice";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [form, setForm] = useState<InvoiceForm | null>(null);
  const [address, setAddress] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      router.refresh();
      return;
    }
    setPhase({ kind: "loading" });
    startTransition(async () => {
      try {
        const draft = await loadInvoiceDraftAction(orderId);
        if (draft.kind === "blocked") setPhase({ kind: "blocked", reason: draft.reason });
        else if (draft.kind === "existing") setPhase({ kind: "done", state: draft.state, message: draft.invoiceError ?? draft.uploadError });
        else {
          setForm(formFrom(draft.decision.receiver));
          setAddress(draft.decision.receiver.address ?? "");
          setPhase({ kind: "form", draft });
        }
      } catch {
        setPhase({ kind: "blocked", reason: "No se pudo abrir la orden. Probá de nuevo." });
      }
    });
  }

  const draft = phase.kind === "form" ? phase.draft : null;
  const validation = draft && form ? buildInvoiceRequest(form, draft.total, draft.threshold) : null;

  function confirm() {
    if (!validation?.request) return;
    const receiver = validation.request.receiver;
    startTransition(async () => {
      let result: PrepareResult;
      try {
        result = await prepareShipmentAction(orderId, {
          docType: receiver.docType,
          docNumber: receiver.docNumber ?? "",
          name: receiver.name ?? "",
          ivaCondition: receiver.ivaCondition,
          address,
        });
      } catch {
        toast.error("No se pudo preparar el envío. Probá de nuevo.");
        return;
      }
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setPhase({ kind: "done", state: result.state, message: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => handleOpenChange(true)}>
        {invoiceOnly ? <FileText data-icon="inline-start" /> : <PackageCheck data-icon="inline-start" />}
        {invoiceOnly ? "Facturar" : "Preparar envío"}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{invoiceOnly ? "Facturar la compra" : "Preparar envío"}</DialogTitle>
          <DialogDescription>
            {phase.kind === "form"
              ? "Revisá los datos de facturación que informó Mercado Libre. Al confirmar se emite la factura y se sube a la compra."
              : phase.kind === "done"
                ? invoiceOnly
                  ? "La compra ya salió: imprimí la factura si la necesitás."
                  : "Imprimí la factura y la etiqueta, y pegá las dos en el paquete."
                : "Factura e impresiones de la compra."}
          </DialogDescription>
        </DialogHeader>

        {phase.kind === "loading" && <p className="text-sm text-muted-foreground">Consultando Mercado Libre...</p>}

        {phase.kind === "blocked" && <Notice>{phase.reason}</Notice>}

        {phase.kind === "form" && draft && form && (
          <div className="flex flex-col gap-3">
            {draft.billingError && <Notice>{draft.billingError}</Notice>}
            {draft.decision.kind !== "identified" && <Notice>{draft.decision.reason}</Notice>}
            <InvoiceBlock
              form={form}
              onChange={setForm}
              error={validation?.error ?? null}
              mustIdentify={requiresIdentification(draft.total, draft.threshold)}
              showToggle={false}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-address">Domicilio (opcional)</Label>
              <Input id="invoice-address" value={address} maxLength={200} onChange={(event) => setAddress(event.target.value)} />
            </div>
            <p className="text-sm">
              Total de la factura: <span className="font-medium">{money(draft.total)}</span>
              <span className="text-muted-foreground"> · solo los productos, sin el envío</span>
            </p>
          </div>
        )}

        {phase.kind === "done" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Factura: <span className="font-medium">{INVOICE_STATE_LABELS[phase.state]}</span>
            </p>
            {phase.message && <Notice>{phase.message}</Notice>}
            {(phase.state === "uploaded" || phase.state === "not_uploaded") && <InvoicePrintButtons orderId={orderId} primary />}
            {hasLabel && (
              <>
                {phase.state === "pending" && <Notice>La orden todavía no tiene factura: podés imprimir la etiqueta igual.</Notice>}
                <LabelButtons orderId={orderId} primary={false} />
              </>
            )}
          </div>
        )}

        {phase.kind === "form" && (
          <DialogFooter>
            <Button onClick={confirm} disabled={pending || !validation?.request}>
              {pending ? "Emitiendo..." : "Confirmar y emitir la factura"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
