"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { previewClose, confirmClose } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CloseShiftWizard() {
  const [countedCash, setCountedCash] = useState("");
  const [preview, setPreview] = useState<{ expected: number; difference: number } | null>(null);
  const [reason, setReason] = useState("");
  const [closed, setClosed] = useState(false);
  const [previewing, startPreview] = useTransition();
  const [confirming, startConfirm] = useTransition();

  if (closed) {
    return <p className="text-sm">Caja cerrada.</p>;
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
    const value = Number(countedCash);
    if (preview && preview.difference !== 0 && !reason.trim()) {
      toast.error("Hay una diferencia: completá el motivo.");
      return;
    }
    startConfirm(async () => {
      const result = await confirmClose(value, reason || undefined);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setClosed(true);
    });
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <h2 className="text-sm font-semibold">Cerrar caja</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="countedCash">Efectivo contado</Label>
        <Input
          id="countedCash"
          type="number"
          min={0}
          step="0.01"
          value={countedCash}
          onChange={(e) => {
            setCountedCash(e.target.value);
            setPreview(null);
          }}
        />
      </div>

      {!preview && (
        <Button type="button" variant="outline" disabled={previewing} onClick={handlePreview} className="w-fit">
          {previewing ? "Calculando..." : "Calcular diferencia"}
        </Button>
      )}

      {preview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Esperado: ${preview.expected.toFixed(0)} · Contado: ${Number(countedCash).toFixed(0)} ·{" "}
            <span className={preview.difference !== 0 ? "text-destructive" : ""}>
              Diferencia: {preview.difference > 0 ? "+" : ""}${preview.difference.toFixed(0)}
            </span>
          </p>
          {preview.difference !== 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="differenceReason">Motivo de la diferencia</Label>
              <Input id="differenceReason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <Button type="button" disabled={confirming} onClick={handleConfirm} className="w-fit">
            {confirming ? "Cerrando..." : "Confirmar cierre"}
          </Button>
        </div>
      )}
    </div>
  );
}
