"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reprintTicket, voidSale } from "../../actions";
import { Button } from "@/components/ui/button";
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
  const [voiding, setVoiding] = useState(false);
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
      window.open(`/ventas/${saleId}/ticket`, "_blank");
    });
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
      setVoiding(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {canReprint && (
          <Button type="button" variant="outline" disabled={pendingReprint} onClick={handleReprint}>
            {pendingReprint ? "Abriendo..." : "Reimprimir ticket"}
          </Button>
        )}
        {canVoid && !alreadyVoided && !voiding && (
          <Button type="button" variant="destructive" onClick={() => setVoiding(true)}>
            Anular venta
          </Button>
        )}
      </div>
      {voiding && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="voidReason">Motivo de la anulación</Label>
            <Input id="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-64" />
          </div>
          <Button type="button" variant="destructive" disabled={pendingVoid} onClick={handleVoid}>
            {pendingVoid ? "Anulando..." : "Confirmar anulación"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setVoiding(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
