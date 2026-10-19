"use client";

import { useActionState } from "react";
import { openShift, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function OpenShiftForm() {
  const [state, formAction, pending] = useActionState(openShift, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="openingAmount">Monto inicial en efectivo</Label>
        <Input id="openingAmount" name="openingAmount" type="number" min={0} step="0.01" placeholder="0" />
        <p className="text-xs text-muted-foreground">Es el efectivo con el que arranca el turno. Vacío = $0.</p>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Abriendo..." : "Abrir caja"}
      </Button>
    </form>
  );
}
