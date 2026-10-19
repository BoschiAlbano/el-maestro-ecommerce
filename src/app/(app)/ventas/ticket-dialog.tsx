"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getTicketData, type TicketData } from "./actions";
import { buildTicketLines } from "@/lib/ticket-lines";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Mismo estilo en pantalla y en papel. Las térmicas en modo texto ignoran casi todo el CSS (ver `lib/ticket-texto.ts`):
// el ticket es texto monoespaciado ya alineado con espacios, y el estilo solo fija la tipografía.
const TICKET_STYLE = {
  fontFamily: "monospace",
  fontSize: "12px",
  lineHeight: "1.3",
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
} as const;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Imprime el ticket con la impresión del navegador (`window.print()`): arma una
 * página mínima con solo el texto del ticket en un iframe oculto y la imprime
 * ahí, así no sale el resto de la pantalla. Con la impresión sin diálogo de la
 * PC de caja (docs/PROJECT.md, sección 6) sale directo a la térmica de 58 mm.
 */
export function printTicket(lines: string[]) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  // El listener va en el iframe (no en su window): `document.open()` borra los de la window.
  iframe.addEventListener("load", () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  });
  const style = Object.entries(TICKET_STYLE)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}:${value}`)
    .join(";");
  iframe.srcdoc =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<style>@page{size:58mm auto;margin:0}html,body{margin:0;background:#fff;color:#000}</style></head>` +
    `<body><pre style="${style}">${escapeHtml(lines.join("\n"))}</pre></body></html>`;
  document.body.appendChild(iframe);
}

/** El ticket tal como sale en papel: texto monoespaciado alineado con espacios (`buildTicketLines`). */
export function TicketPaper({ data }: { data: TicketData }) {
  return (
    <div className="h-fit bg-white p-3 text-black">
      <pre style={TICKET_STYLE}>{buildTicketLines(data).join("\n")}</pre>
    </div>
  );
}

/**
 * El ticket de una venta en una ventana modal (specs/008, RF-5 y RF-14).
 * `saleId` en `null` = cerrado. `closeLabel` es el texto del botón que cierra
 * (por ejemplo "Nueva venta" justo después de vender).
 */
export function TicketDialog({
  saleId,
  onClose,
  closeLabel = "Cerrar",
}: {
  saleId: string | null;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <Dialog open={saleId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {saleId && <TicketContent saleId={saleId} onClose={onClose} closeLabel={closeLabel} />}
      </DialogContent>
    </Dialog>
  );
}

// Vive adentro del contenido del modal: al cerrar se desmonta y la próxima vez carga de cero.
function TicketContent({ saleId, onClose, closeLabel }: { saleId: string; onClose: () => void; closeLabel: string }) {
  const [data, setData] = useState<TicketData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTicketData(saleId)
      .then((result) => {
        if (cancelled) return;
        if (result) setData(result);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{data ? `Ticket #${data.ticketNumber}` : "Ticket"}</DialogTitle>
        <DialogDescription>
          {failed ? "No se pudo cargar el ticket." : "Imprimilo para entregárselo al cliente."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[60vh] justify-center overflow-y-auto rounded-lg bg-muted p-3">
        {!data && !failed && <p className="py-10 text-sm text-muted-foreground">Cargando ticket…</p>}
        {data && <TicketPaper data={data} />}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {closeLabel}
        </Button>
        <Button type="button" disabled={!data} onClick={() => data && printTicket(buildTicketLines(data))}>
          <Printer data-icon="inline-start" />
          Imprimir
        </Button>
      </DialogFooter>
    </>
  );
}
