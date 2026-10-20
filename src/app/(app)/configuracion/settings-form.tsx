"use client";

import { useActionState } from "react";
import { updateArticleSettings, updateTicketSettings, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SettingsFormProps = {
  settings: { razonSocial: string; textoTicketAdicional: string | null; stockMinimoDefault: number };
};

const initialState: ActionState = {};

function FormStatus({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Guardado.</p>}
    </>
  );
}

function TicketForm({ settings }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateTicketSettings, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="razonSocial">Razón social</Label>
        <Input id="razonSocial" name="razonSocial" defaultValue={settings.razonSocial} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="textoTicketAdicional">Texto adicional del ticket</Label>
        <Input
          id="textoTicketAdicional"
          name="textoTicketAdicional"
          defaultValue={settings.textoTicketAdicional ?? ""}
        />
      </div>
      <FormStatus state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

function ArticleForm({ settings }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateArticleSettings, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
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
        <p className="text-xs text-muted-foreground">Se usa al crear un producto nuevo.</p>
      </div>
      <FormStatus state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

/** Configuración del sistema separada por tema; cada pestaña se guarda por su cuenta. */
export function SettingsForm({ settings }: SettingsFormProps) {
  return (
    <Tabs defaultValue="ticket">
      <TabsList>
        <TabsTrigger value="ticket">Ticket</TabsTrigger>
        <TabsTrigger value="articulos">Artículos</TabsTrigger>
      </TabsList>
      <TabsContent value="ticket" className="pt-2">
        <TicketForm settings={settings} />
      </TabsContent>
      <TabsContent value="articulos" className="pt-2">
        <ArticleForm settings={settings} />
      </TabsContent>
    </Tabs>
  );
}
