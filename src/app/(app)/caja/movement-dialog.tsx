"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { registerMovement } from "./actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MovementType = "INGRESO" | "EGRESO";
type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA";

const COPY: Record<MovementType, { button: string; description: string; placeholder: string; success: string }> = {
  INGRESO: {
    button: "Registrar ingreso",
    description: "Plata que entra a la caja y no es una venta: por ejemplo, un aporte o cambio que se suma.",
    placeholder: "Ej.: aporte para cambio",
    success: "Ingreso registrado.",
  },
  EGRESO: {
    button: "Registrar egreso",
    description: "Plata que sale de la caja: por ejemplo, un gasto, un pago a un proveedor o un retiro.",
    placeholder: "Ej.: pago de flete",
    success: "Egreso registrado.",
  },
};

/** Alta de un movimiento manual de caja en una ventana modal (specs/007, RF-2 y RF-10). */
export function MovementDialog({
  type,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: {
  type: MovementType;
  /** Para abrirlo desde afuera (por ejemplo, desde un menú): se pasa `open` y `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `false` oculta el botón propio cuando lo abre otro control. */
  showTrigger?: boolean;
}) {
  const copy = COPY[type];
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPaymentMethod("EFECTIVO");
      setError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await registerMovement({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(copy.success);
      setOpen(false);
    });
  }

  const Icon = type === "INGRESO" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger render={<Button variant="outline" />}>
          <Icon data-icon="inline-start" />
          {copy.button}
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.button}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="type" value={type} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`amount-${type}`}>Monto</Label>
            <Input
              id={`amount-${type}`}
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              autoFocus
              placeholder="0"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`concept-${type}`}>Concepto</Label>
            <Input id={`concept-${type}`} name="concept" required placeholder={copy.placeholder} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`paymentMethod-${type}`}>Medio de pago</Label>
            <Select
              name="paymentMethod"
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              items={{ EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
            >
              <SelectTrigger id={`paymentMethod-${type}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {paymentMethod === "EFECTIVO"
                ? "Cambia el efectivo que debería haber en la caja."
                : "No cambia el efectivo esperado: se registra aparte, para controlar las transferencias."}
            </p>
          </div>

          {paymentMethod === "TRANSFERENCIA" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`transferReference-${type}`}>Últimos 4 dígitos del comprobante</Label>
              <Input
                id={`transferReference-${type}`}
                name="transferReference"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                required
                placeholder="0000"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
