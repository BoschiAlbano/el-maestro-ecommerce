"use client";

import { useActionState, useState } from "react";
import { registerMovement, type ActionState } from "./actions";
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

const initialState: ActionState = {};

export function CashMovementForm() {
  const [state, formAction, pending] = useActionState(registerMovement, initialState);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Tipo</Label>
        <Select name="type" defaultValue="INGRESO" items={{ INGRESO: "Ingreso", EGRESO: "Egreso" }}>
          <SelectTrigger id="type" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INGRESO">Ingreso</SelectItem>
            <SelectItem value="EGRESO">Egreso</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required className="w-28" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="concept">Concepto</Label>
        <Input id="concept" name="concept" required className="w-48" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="paymentMethod">Medio de pago</Label>
        <Select
          name="paymentMethod"
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as "EFECTIVO" | "TRANSFERENCIA")}
          items={{ EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
        >
          <SelectTrigger id="paymentMethod" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {paymentMethod === "TRANSFERENCIA" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="transferReference">Últimos 4 dígitos</Label>
          <Input
            id="transferReference"
            name="transferReference"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            required
            className="w-24"
          />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Registrar"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
