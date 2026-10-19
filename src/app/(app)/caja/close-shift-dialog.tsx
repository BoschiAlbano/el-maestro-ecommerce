"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { previewClose, confirmClose } from "./actions";
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

type Preview = { expected: number; difference: number };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Cierre de caja en dos pasos dentro de una ventana modal (specs/007, RF-5 y
 * RF-10): se cuenta el efectivo, se calcula la diferencia contra el esperado
 * y recién después se confirma (con motivo si hay diferencia).
 */
export function CloseShiftDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const [previewing, startPreview] = useTransition();
  const [confirming, startConfirm] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCountedCash("");
      setPreview(null);
      setReason("");
    }
  }

  function handlePreview() {
    const value = Number(countedCash);
    if (!countedCash || Number.isNaN(value) || value < 0) {
      toast.error("Ingresá el efectivo contado.");
      return;
    }
    startPreview(async () => {
      const result = await previewClose(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPreview({ expected: result.expected!, difference: result.difference! });
    });
  }

  function handleConfirm() {
    if (preview && preview.difference !== 0 && !reason.trim()) {
      toast.error("Hay una diferencia: completá el motivo.");
      return;
    }
    startConfirm(async () => {
      const result = await confirmClose(Number(countedCash), reason || undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Caja cerrada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <Lock data-icon="inline-start" />
        Cerrar caja
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>
            Contá el efectivo que hay en la caja. El sistema lo compara con lo que debería haber y te muestra la
            diferencia antes de cerrar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="countedCash">Efectivo contado</Label>
          <Input
            id="countedCash"
            type="number"
            min={0}
            step="0.01"
            autoFocus
            placeholder="0"
            value={countedCash}
            onChange={(e) => {
              setCountedCash(e.target.value);
              setPreview(null);
            }}
          />
        </div>

        {preview && (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Esperado</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(preview.expected)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Contado</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(Number(countedCash))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Diferencia</dt>
                <dd className={`font-semibold tabular-nums ${preview.difference !== 0 ? "text-destructive" : ""}`}>
                  {preview.difference > 0 ? "+" : ""}
                  {formatMoney(preview.difference)}
                </dd>
              </div>
            </dl>
            {preview.difference !== 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="differenceReason">Motivo de la diferencia</Label>
                <Input
                  id="differenceReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Obligatorio para poder cerrar"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!preview ? (
            <Button type="button" disabled={previewing} onClick={handlePreview}>
              {previewing ? "Calculando..." : "Calcular diferencia"}
            </Button>
          ) : (
            <Button type="button" disabled={confirming} onClick={handleConfirm}>
              {confirming ? "Cerrando..." : "Confirmar cierre"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
