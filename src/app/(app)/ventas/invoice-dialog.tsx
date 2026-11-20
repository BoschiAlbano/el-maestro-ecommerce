"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { getInvoiceView, retryInvoice } from "./facturacion-actions";
import { KIND_TITLE, buildInvoiceTicketHtml, formatInvoiceNumber, type InvoiceView } from "@/lib/facturacion/invoice-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Imprime una página HTML ya armada con la impresión del navegador, en un
 * iframe oculto (como el ticket, specs/008): con la impresión sin diálogo de la
 * PC de caja sale directo a la térmica de 58 mm.
 */
export function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.addEventListener("load", () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  });
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

/**
 * El comprobante de una venta en una ventana modal (specs/023, RF-19). Autorizado:
 * se ve y se imprime. Pendiente: dice por qué, deja reintentar y ofrece el ticket
 * de la venta como respaldo (RF-10). `invoiceId` en `null` = cerrado.
 */
export function InvoiceDialog({
  invoiceId,
  onClose,
  closeLabel = "Cerrar",
  onShowTicket,
}: {
  invoiceId: string | null;
  onClose: () => void;
  closeLabel?: string;
  /** Pasa al ticket de la venta (por ejemplo, mientras la factura está pendiente). */
  onShowTicket?: () => void;
}) {
  return (
    <Dialog open={invoiceId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {invoiceId && (
          <InvoiceContent invoiceId={invoiceId} onClose={onClose} closeLabel={closeLabel} onShowTicket={onShowTicket} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Vive adentro del contenido del modal: al cerrar se desmonta y la próxima vez carga de cero.
function InvoiceContent({
  invoiceId,
  onClose,
  closeLabel,
  onShowTicket,
}: {
  invoiceId: string;
  onClose: () => void;
  closeLabel: string;
  onShowTicket?: () => void;
}) {
  const [view, setView] = useState<InvoiceView | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, startRetry] = useTransition();
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getInvoiceView(invoiceId);
      if (result) setView(result);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, [invoiceId]);

  useEffect(() => {
    // Carga inicial del comprobante: el estado se actualiza al llegar la respuesta del servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const authorized = view?.status === "AUTHORIZED";
  const pending = view?.status === "PENDING";

  function retry() {
    setRetryMessage(null);
    startRetry(async () => {
      const result = await retryInvoice(invoiceId);
      if (result.error) setRetryMessage(result.error);
      else if (result.invoice?.status === "pending") setRetryMessage(result.invoice.reason ?? "Sigue pendiente.");
      await load();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {view ? (
            <span className="flex flex-wrap items-center gap-2">
              {KIND_TITLE[view.kind]}
              {authorized && view.number !== null && ` ${formatInvoiceNumber(view.pointOfSale, view.number)}`}
              {pending && <Badge variant="outline">Pendiente</Badge>}
            </span>
          ) : (
            "Factura"
          )}
        </DialogTitle>
        <DialogDescription>
          {failed
            ? "No se pudo cargar el comprobante."
            : pending
              ? "Todavía no está emitida en ARCA. La venta ya quedó registrada."
              : "Imprimilo para entregárselo al cliente."}
        </DialogDescription>
      </DialogHeader>

      {!view && !failed && <p className="py-10 text-center text-sm text-muted-foreground">Cargando comprobante…</p>}

      {authorized && view && (
        <iframe
          title="Vista del comprobante"
          srcDoc={buildInvoiceTicketHtml(view)}
          className="h-[55vh] w-full rounded-lg border bg-white"
        />
      )}

      {pending && view && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
          <p>{retryMessage ?? view.lastError ?? "ARCA todavía no respondió."}</p>
          <p className="text-muted-foreground">
            Podés volver a intentar ahora o más tarde desde el historial de ventas. Mientras tanto, el ticket sirve como
            constancia de la venta.
          </p>
        </div>
      )}

      <DialogFooter className="flex-wrap">
        <Button type="button" variant="outline" onClick={onClose}>
          {closeLabel}
        </Button>
        {onShowTicket && (authorized || pending || failed) && (
          <Button type="button" variant="outline" onClick={onShowTicket}>
            Ver ticket
          </Button>
        )}
        {pending && (
          <Button type="button" disabled={retrying} onClick={retry}>
            <RefreshCw data-icon="inline-start" />
            {retrying ? "Reintentando..." : "Reintentar"}
          </Button>
        )}
        {authorized && view && (
          <>
            <a
              href={`/comprobantes/${view.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted"
            >
              <Download className="size-4" aria-hidden />
              PDF
            </a>
            <Button type="button" onClick={() => printHtml(buildInvoiceTicketHtml(view))}>
              <Printer data-icon="inline-start" />
              Imprimir
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
