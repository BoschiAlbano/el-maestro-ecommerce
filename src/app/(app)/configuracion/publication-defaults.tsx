"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePublicationDefaults } from "./mercadolibre-actions";

export type PublicationDefaultsValue = {
  listingType: "gold_special" | "gold_pro";
  warrantyType: "SELLER" | "FACTORY" | null;
  warrantyDays: number | null;
  localPickUp: boolean;
};

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * Valores por defecto de las publicaciones nuevas (specs/025, RF-5): tipo de
 * publicación, garantía y retiro en el local. Se aplican al preparar la
 * publicación de un producto que todavía no tiene datos guardados.
 */
export function PublicationDefaults({ value, canEdit }: { value: PublicationDefaultsValue; canEdit: boolean }) {
  const [form, setForm] = useState(value);
  const [pending, startTransition] = useTransition();
  const changed = JSON.stringify(form) !== JSON.stringify(value);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Valores por defecto para publicar</span>
        <p className="text-sm text-muted-foreground">Se usan al preparar la publicación de un producto; en cada producto se pueden cambiar.</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await savePublicationDefaults(form);
            if (result.error) toast.error(result.error);
            else toast.success(result.success);
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ml-default-listing">Tipo de publicación</Label>
            <select
              id="ml-default-listing"
              className={SELECT_CLASS}
              disabled={!canEdit}
              value={form.listingType}
              onChange={(e) => setForm({ ...form, listingType: e.target.value === "gold_pro" ? "gold_pro" : "gold_special" })}
            >
              <option value="gold_special">Clásica</option>
              <option value="gold_pro">Premium (cuotas sin interés)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ml-default-warranty">Garantía</Label>
            <div className="flex gap-2">
              <select
                id="ml-default-warranty"
                className={SELECT_CLASS}
                disabled={!canEdit}
                value={form.warrantyType ?? ""}
                onChange={(e) => {
                  const type = e.target.value === "SELLER" || e.target.value === "FACTORY" ? e.target.value : null;
                  setForm({ ...form, warrantyType: type, warrantyDays: type ? (form.warrantyDays ?? 30) : null });
                }}
              >
                <option value="SELLER">Del vendedor</option>
                <option value="FACTORY">De fábrica</option>
                <option value="">Sin garantía</option>
              </select>
              {form.warrantyType && (
                <div className="flex items-center gap-1.5">
                  <Input
                    aria-label="Días de garantía"
                    inputMode="numeric"
                    className="w-20"
                    disabled={!canEdit}
                    value={form.warrantyDays ?? ""}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setForm({ ...form, warrantyDays: Number.isFinite(n) && n > 0 ? n : null });
                    }}
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.localPickUp} disabled={!canEdit} onChange={(e) => setForm({ ...form, localPickUp: e.target.checked })} />
          Ofrecer retiro en el local, además de Mercado Envíos
        </label>
        {canEdit && (
          <Button type="submit" variant="outline" className="w-fit" disabled={pending || !changed}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        )}
      </form>
    </div>
  );
}
