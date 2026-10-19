"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Ban } from "lucide-react";
import { toast } from "sonner";
import { reprintTicket, voidSale } from "../../actions";
import { TicketDialog } from "../../ticket-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SaleActions({
  saleId,
  canReprint,
  canVoid,
  alreadyVoided,
}: {
  saleId: string;
  canReprint: boolean;
  canVoid: boolean;
  alreadyVoided: boolean;
}) {
  const router = useRouter();
  const [voidOpen, setVoidOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingReprint, startReprint] = useTransition();
  const [pendingVoid, startVoid] = useTransition();

  function handleReprint() {
    startReprint(async () => {
      const result = await reprintTicket(saleId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTicketOpen(true);
    });
  }

  function handleVoidOpenChange(next: boolean) {
    setVoidOpen(next);
    if (next) setReason("");
  }

  function handleVoid() {
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio.");
      return;
    }
    startVoid(async () => {
      const result = await voidSale(saleId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Venta anulada.");
      setVoidOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canReprint && (
        <Button type="button" variant="outline" disabled={pendingReprint} onClick={handleReprint}>
          <Printer data-icon="inline-start" />
          {pendingReprint ? "Abriendo..." : "Reimprimir ticket"}
        </Button>
      )}
      {canVoid && !alreadyVoided && (
        <Dialog open={voidOpen} onOpenChange={handleVoidOpenChange}>
          <DialogTrigger render={<Button variant="destructive" />}>
            <Ban data-icon="inline-start" />
            Anular venta
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anular venta</DialogTitle>
              <DialogDescription>
                Se devuelve el stock de cada producto y se registra un egreso en la caja abierta por lo que se
                cobró. No se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="voidReason">Motivo de la anulación</Label>
              <Input
                id="voidReason"
                value={reason}
                autoFocus
                placeholder="Obligatorio"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="destructive" disabled={pendingVoid} onClick={handleVoid}>
                {pendingVoid ? "Anulando..." : "Confirmar anulación"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <TicketDialog saleId={ticketOpen ? saleId : null} onClose={() => setTicketOpen(false)} />
    </div>
  );
}
