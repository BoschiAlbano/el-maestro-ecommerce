"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOrdersStartDate } from "../ordenes/actions";

/**
 * Desde qué fecha se registran las compras de Mercado Libre (specs/022, RF-9b).
 * Las anteriores las gestionó el cliente en Mercado Libre: no descuentan stock
 * ni aparecen en analíticas.
 */
export function OrdersStartDate({ value, canEdit }: { value: string | null; canEdit: boolean }) {
  const [date, setDate] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <Label htmlFor="ml-orders-start">Registrar compras de Mercado Libre desde</Label>
      <p className="text-sm text-muted-foreground">
        Las compras anteriores a esta fecha no se traen: no descuentan stock ni aparecen en analíticas. Sin fecha no se
        registra ninguna. Se carga el día que el sistema empieza a usarse con Mercado Libre.
      </p>
      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await saveOrdersStartDate(date || null);
              if (result.error) toast.error(result.error);
              else toast.success(result.success);
            });
          }}
        >
          <Input id="ml-orders-start" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <Button type="submit" variant="outline" disabled={pending || date === (value ?? "")}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      ) : (
        <p className="text-sm">{value ?? "Sin fecha cargada"}</p>
      )}
    </div>
  );
}
