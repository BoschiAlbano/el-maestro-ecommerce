"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { cancelOrder } from "../actions";
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

/**
 * Cancelación de un pedido pendiente en una ventana modal, con motivo
 * obligatorio (specs/009, RF-7, RF-10 y RF-11). Se usa con su propio botón en el
 * detalle, o controlada desde afuera (`open`/`onOpenChange`, sin botón) desde el
 * menú de acciones de la lista.
 */
export function CancelOrderDialog({
  orderId,
  hasDepositToReturn,
  open: controlledOpen,
  onOpenChange,
}: {
  orderId: string;
  hasDepositToReturn: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = controlledOpen !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlled ? controlledOpen : innerOpen;
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function setOpen(next: boolean) {
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
    if (next) setReason("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio.");
      return;
    }
    startTransition(async () => {
      const result = await cancelOrder(orderId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pedido cancelado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger render={<Button variant="outline" className="text-destructive" />}>
          <Ban data-icon="inline-start" />
          Cancelar pedido
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              {hasDepositToReturn
                ? "La seña que todavía no se usó se devuelve como egreso en la caja abierta. No se puede deshacer."
                : "El pedido pasa a cancelado y no se mueve nada de la caja. No se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancelReason">Motivo de la cancelación</Label>
            <Input
              id="cancelReason"
              value={reason}
              autoFocus
              placeholder="Obligatorio"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
