"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { getDepositTicketData } from "../actions";
import { TicketDialog, TicketLinesPaper, printTicket } from "../../ventas/ticket-dialog";
import { buildDepositTicketLines, type DepositTicketInput } from "@/lib/ticket-lines";
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
 * Abre el ticket que pide la URL de la pantalla de un pedido: `?venta=<id>` es el
 * ticket de una entrega y `?ticket=sena` el de la seña. Vive siempre montado en
 * la página, a propósito: al entregar lo último del pedido desaparecen los
 * botones de acción, y si el ticket dependiera de ellos se cerraría solo
 * antes de poder imprimirlo.
 */
export function OrderTicketHost({ orderId }: { orderId: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const saleId = params.get("venta");
  const showDeposit = params.get("ticket") === "sena";

  function close() {
    router.replace(pathname);
    router.refresh();
  }

  return (
    <>
      <TicketDialog saleId={saleId} onClose={close} />
      <DepositTicketDialog orderId={orderId} open={showDeposit} onClose={close} />
    </>
  );
}

function DepositTicketDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {open && <DepositTicketContent orderId={orderId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

// Vive adentro del contenido del modal: al cerrar se desmonta y la próxima vez carga de cero.
function DepositTicketContent({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [data, setData] = useState<DepositTicketInput | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDepositTicketData(orderId)
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
  }, [orderId]);

  const lines = data ? buildDepositTicketLines(data) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ticket de seña</DialogTitle>
        <DialogDescription>
          {failed ? "No se pudo cargar el ticket." : "Imprimilo para entregárselo al cliente."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[60vh] justify-center overflow-y-auto rounded-lg bg-muted p-3">
        {!lines && !failed && <p className="py-10 text-sm text-muted-foreground">Cargando ticket…</p>}
        {lines && <TicketLinesPaper lines={lines} />}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button type="button" disabled={!lines} onClick={() => lines && printTicket(lines)}>
          <Printer data-icon="inline-start" />
          Imprimir
        </Button>
      </DialogFooter>
    </>
  );
}
