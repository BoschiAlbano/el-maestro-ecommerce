"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio.");
      return;
    }
    startTransition(async () => {
      const result = await cancelOrder(orderId, reason);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cancelReason">Motivo de la cancelación</Label>
        <Input id="cancelReason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-64" />
      </div>
      <Button type="button" variant="destructive" disabled={pending} onClick={handleSubmit}>
        {pending ? "Cancelando..." : "Cancelar pedido"}
      </Button>
    </div>
  );
}
