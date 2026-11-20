"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { issueInvoiceForSale, retryInvoice } from "../../facturacion-actions";
import { InvoiceBlock } from "../../invoice-block";
import { InvoiceDialog } from "../../invoice-dialog";
import { EMPTY_INVOICE_FORM, buildInvoiceRequest } from "@/lib/facturacion/invoice-form";
import { requiresIdentification } from "@/lib/facturacion/invoice-policy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SaleInvoiceRow = {
  id: string;
  title: string;
  numberLabel: string | null;
  status: "PENDING" | "AUTHORIZED" | "DISCARDED";
  date: string | null;
  lastError: string | null;
  isTest: boolean;
};

const STATUS_LABEL = { PENDING: "Pendiente", AUTHORIZED: "Emitida", DISCARDED: "Sin efecto" } as const;

/**
 * El panel "Facturación" de una venta (specs/023, RF-15 a RF-17): los
 * comprobantes que tiene, con reintento si alguno quedó pendiente, y la opción
 * de facturar una venta que se hizo sin factura.
 */
export function SaleInvoicing({
  saleId,
  total,
  invoices,
  issue,
  blockedReason,
  canRetry,
}: {
  saleId: string;
  total: number;
  invoices: SaleInvoiceRow[];
  /** Se puede facturar esta venta ahora: desde qué total se identifica al comprador. `null` = no. */
  issue: { threshold: number } | null;
  /** Por qué no se puede facturar esta venta (por ejemplo, pasaron los días), o `null`. */
  blockedReason: string | null;
  /** Puede reintentar un comprobante pendiente (permiso de crear ventas). */
  canRetry: boolean;
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function retry(id: string) {
    setRetryingId(id);
    startTransition(async () => {
      const result = await retryInvoice(id);
      setRetryingId(null);
      if (result.error) toast.error(result.error);
      else if (result.invoice?.status === "pending") toast.error(result.invoice.reason ?? "Sigue pendiente.");
      else toast.success("Comprobante emitido.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {invoices.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {invoice.title}
                  {invoice.numberLabel && <span className="tabular-nums">{invoice.numberLabel}</span>}
                  <Badge variant={invoice.status === "PENDING" ? "outline" : "secondary"}>
                    {STATUS_LABEL[invoice.status]}
                  </Badge>
                  {invoice.isTest && invoice.status === "AUTHORIZED" && <Badge variant="outline">De prueba</Badge>}
                </span>
                {invoice.status === "PENDING" && invoice.lastError && (
                  <span className="text-xs text-muted-foreground">{invoice.lastError}</span>
                )}
                {invoice.date && <span className="text-xs text-muted-foreground">{invoice.date}</span>}
              </div>
              <div className="flex gap-2">
                {invoice.status === "AUTHORIZED" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setViewing(invoice.id)}>
                    <FileText data-icon="inline-start" />
                    Ver
                  </Button>
                )}
                {invoice.status === "PENDING" && canRetry && (
                  <Button type="button" size="sm" disabled={retryingId === invoice.id} onClick={() => retry(invoice.id)}>
                    <RefreshCw data-icon="inline-start" />
                    {retryingId === invoice.id ? "Reintentando..." : "Reintentar"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {issue && (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setIssuing(true)}>
          <FileText data-icon="inline-start" />
          Facturar esta venta
        </Button>
      )}
      {!issue && blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}

      {issue && issuing && (
        <IssueDialog
          saleId={saleId}
          total={total}
          threshold={issue.threshold}
          onClose={() => setIssuing(false)}
          onIssued={(invoiceId) => {
            setIssuing(false);
            setViewing(invoiceId);
            router.refresh();
          }}
        />
      )}

      <InvoiceDialog invoiceId={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function IssueDialog({
  saleId,
  total,
  threshold,
  onClose,
  onIssued,
}: {
  saleId: string;
  total: number;
  threshold: number;
  onClose: () => void;
  onIssued: (invoiceId: string) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_INVOICE_FORM, enabled: true });
  const [pending, startTransition] = useTransition();
  const { request, error } = buildInvoiceRequest(form, total, threshold);

  function issue() {
    if (!request) return;
    startTransition(async () => {
      const result = await issueInvoiceForSale(saleId, request);
      if (result.error || !result.invoice) {
        toast.error(result.error ?? "No se pudo emitir la factura.");
        return;
      }
      if (result.invoice.status === "pending") {
        toast.error(`La factura quedó pendiente: ${result.invoice.reason ?? "ARCA no respondió."}`);
      }
      onIssued(result.invoice.id);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Facturar esta venta</DialogTitle>
          <DialogDescription>La factura sale con la fecha de hoy y por el total de la venta.</DialogDescription>
        </DialogHeader>
        <InvoiceBlock
          form={form}
          onChange={setForm}
          error={error}
          mustIdentify={requiresIdentification(total, threshold)}
          showToggle={false}
        />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending || !request} onClick={issue}>
            {pending ? "Emitiendo..." : "Emitir factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
