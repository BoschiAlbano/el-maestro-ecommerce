"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { payDeposit } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DepositForm({ orderId }: { orderId: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [transferReference, setTransferReference] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    startTransition(async () => {
      const result = await payDeposit(orderId, value, method, method === "TRANSFERENCIA" ? transferReference : undefined);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="depositAmount">Monto de la seña</Label>
        <Input
          id="depositAmount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Medio</Label>
        <Select
          value={method}
          onValueChange={(v) => setMethod(v as "EFECTIVO" | "TRANSFERENCIA")}
          items={{ EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {method === "TRANSFERENCIA" && (
        <div className="flex flex-col gap-2">
          <Label>Últimos 4 dígitos</Label>
          <Input
            maxLength={4}
            value={transferReference}
            onChange={(e) => setTransferReference(e.target.value)}
            className="w-24"
          />
        </div>
      )}
      <Button type="button" disabled={pending} onClick={handleSubmit}>
        {pending ? "Cobrando..." : "Cobrar seña"}
      </Button>
    </div>
  );
}
