"use client";

import { useActionState } from "react";
import { updateArticleSettings, updateTicketSettings, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ResetSummary } from "@/lib/system-reset";
import type { MlConnectionView } from "@/lib/mercadolibre/connection";
import type { MlConnectResult } from "@/lib/mercadolibre/connection-result";
import { ResetSystemTab } from "./reset-system-tab";
import { MercadoLibreTab } from "./mercadolibre-tab";
import type { PublicationDefaultsValue } from "./publication-defaults";
import { FacturacionTab } from "./facturacion-tab";
import type { FacturacionView } from "@/lib/facturacion/facturacion-view";

type Settings = { razonSocial: string; textoTicketAdicional: string | null; stockMinimoDefault: number };

type SettingsFormProps = {
  settings: Settings;
  /** Con permiso "editar": ve y guarda Ticket y Artículos. */
  canEdit: boolean;
  /** Solo el Dueño recibe el resumen y ve la pestaña "Sistema" (specs/017). */
  resetSummary?: ResetSummary;
  /** Pestaña "Mercado Libre" (specs/019): la ve quien tiene permiso "ver". */
  mercadoLibre: {
    view: MlConnectionView;
    isOwner: boolean;
    result: MlConnectResult | null;
    ordersStartDate: string | null;
    publicationDefaults: PublicationDefaultsValue;
  };
  /** Pestaña "Facturación" (specs/023): la ve quien tiene permiso "ver"; el Dueño edita. */
  facturacion: { view: FacturacionView; isOwner: boolean };
  /** Pestaña con la que abre, si la dirección la pide y el usuario la puede ver. */
  initialTab?: string;
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

function TicketForm({ settings }: { settings: Settings }) {
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

function ArticleForm({ settings }: { settings: Settings }) {
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
export function SettingsForm({ settings, canEdit, resetSummary, mercadoLibre, facturacion, initialTab }: SettingsFormProps) {
  const tabs = [
    ...(canEdit ? ["ticket", "articulos"] : []),
    "mercadolibre",
    "facturacion",
    ...(resetSummary ? ["sistema"] : []),
  ];
  const defaultTab = initialTab && tabs.includes(initialTab) ? initialTab : tabs[0];

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        {canEdit && <TabsTrigger value="ticket">Ticket</TabsTrigger>}
        {canEdit && <TabsTrigger value="articulos">Artículos</TabsTrigger>}
        <TabsTrigger value="mercadolibre">Mercado Libre</TabsTrigger>
        <TabsTrigger value="facturacion">Facturación</TabsTrigger>
        {resetSummary && <TabsTrigger value="sistema">Sistema</TabsTrigger>}
      </TabsList>
      {canEdit && (
        <TabsContent value="ticket" className="pt-2">
          <TicketForm settings={settings} />
        </TabsContent>
      )}
      {canEdit && (
        <TabsContent value="articulos" className="pt-2">
          <ArticleForm settings={settings} />
        </TabsContent>
      )}
      <TabsContent value="mercadolibre" className="pt-2">
        <MercadoLibreTab {...mercadoLibre} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="facturacion" className="pt-2">
        <FacturacionTab {...facturacion} />
      </TabsContent>
      {resetSummary && (
        <TabsContent value="sistema" className="pt-2">
          <ResetSystemTab summary={resetSummary} />
        </TabsContent>
      )}
    </Tabs>
  );
}
