"use client";

import { useActionState } from "react";
import { updateSettings, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsFormProps = {
  settings: { razonSocial: string; textoTicketAdicional: string | null; stockMinimoDefault: number };
};

const initialState: ActionState = {};

export function SettingsForm({ settings }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateSettings, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="razonSocial">Razón social</Label>
        <Input
          id="razonSocial"
          name="razonSocial"
          defaultValue={settings.razonSocial}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="textoTicketAdicional">Texto adicional del ticket</Label>
        <Input
          id="textoTicketAdicional"
          name="textoTicketAdicional"
          defaultValue={settings.textoTicketAdicional ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="stockMinimoDefault">Stock mínimo por defecto</Label>
        <Input
          id="stockMinimoDefault"
          name="stockMinimoDefault"
          type="number"
          min={0}
          defaultValue={settings.stockMinimoDefault}
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Guardado.</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
