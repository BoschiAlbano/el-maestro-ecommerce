"use client";

import { useState, useTransition } from "react";
import { Banknote, HandCoins, Landmark } from "lucide-react";
import { toast } from "sonner";
import { payDeposit } from "../actions";
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

type Method = "EFECTIVO" | "TRANSFERENCIA";

/** Cobro de la seña de un pedido en una ventana modal (specs/009, RF-3 y RF-10). */
export function DepositDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("EFECTIVO");
  const [transferReference, setTransferReference] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setAmount("");
      setMethod("EFECTIVO");
      setTransferReference("");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    if (method === "TRANSFERENCIA" && !/^\d{4}$/.test(transferReference)) {
      toast.error("Para transferencia, los últimos 4 dígitos del comprobante son obligatorios.");
      return;
    }
    startTransition(async () => {
      const result = await payDeposit(orderId, value, method, method === "TRANSFERENCIA" ? transferReference : undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Seña cobrada.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <HandCoins data-icon="inline-start" />
        Cobrar seña
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Cobrar seña</DialogTitle>
            <DialogDescription>
              Se registra como ingreso en la caja abierta y se descuenta del total en las entregas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="depositAmount">Monto de la seña</Label>
            <Input
              id="depositAmount"
              type="number"
              min={0}
              step="0.01"
              placeholder="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Medio de pago</Label>
            <div className="flex gap-2" role="group" aria-label="Medio de pago">
              <Button
                type="button"
                variant={method === "EFECTIVO" ? "default" : "outline"}
                aria-pressed={method === "EFECTIVO"}
                onClick={() => setMethod("EFECTIVO")}
              >
                <Banknote data-icon="inline-start" />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={method === "TRANSFERENCIA" ? "default" : "outline"}
                aria-pressed={method === "TRANSFERENCIA"}
                onClick={() => setMethod("TRANSFERENCIA")}
              >
                <Landmark data-icon="inline-start" />
                Transferencia
              </Button>
            </div>
          </div>

          {method === "TRANSFERENCIA" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="depositReference">Últimos 4 dígitos del comprobante</Label>
              <Input
                id="depositReference"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Cobrando..." : "Cobrar seña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
