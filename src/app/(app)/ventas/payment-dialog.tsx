"use client";

import { useState } from "react";
import { Banknote, Landmark, Plus, X } from "lucide-react";
import { computeChange, computePaymentStatus } from "@/lib/sale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Method = "EFECTIVO" | "TRANSFERENCIA";

export type SalePayment = { method: Method; amount: number; transferReference?: string };

type PaymentLine = { key: number; method: Method; amount: string; transferReference: string };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Cobro de la venta en una ventana modal (specs/008, RF-10 y RF-11): reparte el
 * total en una o más formas de pago, muestra si está completo, y calcula el
 * vuelto si se anota el efectivo recibido (solo ayuda en pantalla).
 */
export function PaymentDialog({
  open,
  onOpenChange,
  total,
  confirming,
  onConfirm,
  title = "Cobrar venta",
  totalLabel = "Total a cobrar",
  confirmLabel = "Confirmar venta",
  confirmingLabel = "Confirmando...",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  confirming: boolean;
  onConfirm: (payments: SalePayment[]) => void;
  /** Textos para reusar el cobro en otros flujos (por ejemplo, la entrega de un pedido). */
  title?: string;
  totalLabel?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* El formulario vive adentro del contenido: al cerrar se desmonta y la próxima vez arranca de cero. */}
        <PaymentForm
          total={total}
          confirming={confirming}
          onConfirm={onConfirm}
          title={title}
          totalLabel={totalLabel}
          confirmLabel={confirmLabel}
          confirmingLabel={confirmingLabel}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  total,
  confirming,
  onConfirm,
  title,
  totalLabel,
  confirmLabel,
  confirmingLabel,
}: {
  total: number;
  confirming: boolean;
  onConfirm: (payments: SalePayment[]) => void;
  title: string;
  totalLabel: string;
  confirmLabel: string;
  confirmingLabel: string;
}) {
  const [nextKey, setNextKey] = useState(1);
  const [lines, setLines] = useState<PaymentLine[]>([
    { key: 0, method: "EFECTIVO", amount: String(total), transferReference: "" },
  ]);
  const [cashReceived, setCashReceived] = useState("");

  const amounts = lines.map((l) => ({ amount: Number(l.amount) || 0 }));
  const { paid, remaining, status } = computePaymentStatus(total, amounts);
  const cashAmount = lines.reduce((sum, l) => sum + (l.method === "EFECTIVO" ? Number(l.amount) || 0 : 0), 0);
  const hasCash = cashAmount > 0;
  const received = Number(cashReceived);
  const showChange = hasCash && cashReceived !== "" && received >= cashAmount;
  const missingReceived = hasCash && cashReceived !== "" && received < cashAmount;

  const transfersValid = lines.every(
    (l) => l.method !== "TRANSFERENCIA" || !(Number(l.amount) > 0) || /^\d{4}$/.test(l.transferReference),
  );
  const canConfirm = status === "complete" && total > 0 && transfersValid && !confirming;

  function update(key: number, patch: Partial<PaymentLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const rest = remaining > 0 ? String(remaining) : "";
    // La nueva línea es de transferencia si ya hay efectivo, y al revés: es lo más común al dividir.
    const method: Method = lines.some((l) => l.method === "EFECTIVO") ? "TRANSFERENCIA" : "EFECTIVO";
    setLines((prev) => [...prev, { key: nextKey, method, amount: rest, transferReference: "" }]);
    setNextKey((k) => k + 1);
  }

  function setRest(key: number) {
    const others = lines.filter((l) => l.key !== key).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    update(key, { amount: String(Math.max(0, total - others)) });
  }

  function handleConfirm() {
    onConfirm(
      lines
        .filter((l) => Number(l.amount) > 0)
        .map((l) => ({
          method: l.method,
          amount: Number(l.amount),
          transferReference: l.method === "TRANSFERENCIA" ? l.transferReference : undefined,
        })),
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Elegí cómo paga el cliente. Podés dividir el pago en dos medios.</DialogDescription>
      </DialogHeader>

      <div className="rounded-lg bg-muted px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">{totalLabel}</p>
        <p className="text-3xl font-semibold tabular-nums">{formatMoney(total)}</p>
      </div>

      <div className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <div key={line.key} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1" role="group" aria-label={`Medio de pago ${index + 1}`}>
                <Button
                  type="button"
                  size="sm"
                  variant={line.method === "EFECTIVO" ? "default" : "outline"}
                  aria-pressed={line.method === "EFECTIVO"}
                  onClick={() => update(line.key, { method: "EFECTIVO" })}
                >
                  <Banknote data-icon="inline-start" />
                  Efectivo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={line.method === "TRANSFERENCIA" ? "default" : "outline"}
                  aria-pressed={line.method === "TRANSFERENCIA"}
                  onClick={() => update(line.key, { method: "TRANSFERENCIA" })}
                >
                  <Landmark data-icon="inline-start" />
                  Transferencia
                </Button>
              </div>
              {lines.length > 1 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Quitar esta forma de pago"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                >
                  <X />
                </Button>
              )}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`amount-${line.key}`}>Monto</Label>
                <Input
                  id={`amount-${line.key}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.amount}
                  onChange={(e) => update(line.key, { amount: e.target.value })}
                />
              </div>
              {lines.length > 1 && (
                <Button type="button" variant="outline" onClick={() => setRest(line.key)}>
                  Poner el resto
                </Button>
              )}
            </div>

            {line.method === "TRANSFERENCIA" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`ref-${line.key}`}>Últimos 4 dígitos del comprobante</Label>
                <Input
                  id={`ref-${line.key}`}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={line.transferReference}
                  onChange={(e) => update(line.key, { transferReference: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}

        {lines.length < 2 && (
          <Button type="button" variant="outline" className="w-fit" onClick={addLine}>
            <Plus data-icon="inline-start" />
            Dividir pago
          </Button>
        )}
      </div>

      <p
        className={cn(
          "rounded-lg px-3 py-2 text-center text-sm font-medium",
          status === "complete" ? "bg-muted text-foreground" : "bg-destructive/10 text-destructive",
        )}
        aria-live="polite"
      >
        {status === "complete" && `Pago completo (${formatMoney(paid)})`}
        {status === "missing" && `Falta cobrar ${formatMoney(remaining)}`}
        {status === "excess" && `Sobran ${formatMoney(-remaining)}: los pagos superan el total`}
      </p>

      {hasCash && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
          <Label htmlFor="cashReceived">Efectivo recibido (opcional, para calcular el vuelto)</Label>
          <Input
            id="cashReceived"
            type="number"
            min={0}
            step="0.01"
            placeholder={`Ej.: ${formatMoney(Math.ceil(cashAmount / 1000) * 1000 || cashAmount)}`}
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
          />
          {showChange && (
            <p className="text-sm">
              Vuelto a devolver:{" "}
              <span className="text-lg font-semibold tabular-nums">{formatMoney(computeChange(received, cashAmount))}</span>
            </p>
          )}
          {missingReceived && (
            <p className="text-sm text-destructive">Faltan {formatMoney(cashAmount - received)} por recibir.</p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" disabled={!canConfirm} onClick={handleConfirm}>
          {confirming ? confirmingLabel : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
