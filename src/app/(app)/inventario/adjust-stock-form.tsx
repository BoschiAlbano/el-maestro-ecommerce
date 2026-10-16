"use client";

import { useActionState, useState } from "react";
import { adjustStock, type ActionState } from "./actions";
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

export function AdjustStockForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(adjustStock.bind(null, productId), initialState);
  const [kind, setKind] = useState<"AJUSTE" | "MERMA">("AJUSTE");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {kind === "MERMA"
          ? "Merma: se perdió mercadería (rotura, vencimiento, robo). Siempre resta."
          : "Ajuste: corrige un error de conteo o de carga — puede sumar o restar."}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">Tipo</Label>
          <Select
            name="kind"
            value={kind}
            onValueChange={(v) => setKind(v as "AJUSTE" | "MERMA")}
            items={{ AJUSTE: "Ajuste", MERMA: "Merma" }}
          >
            <SelectTrigger id="kind" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AJUSTE">Ajuste</SelectItem>
              <SelectItem value="MERMA">Merma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {kind === "AJUSTE" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="direction">Dirección</Label>
            <Select name="direction" defaultValue="suma" items={{ suma: "Sumar", resta: "Restar" }}>
              <SelectTrigger id="direction" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suma">Sumar</SelectItem>
                <SelectItem value="resta">Restar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">Cantidad</Label>
          <Input id="quantity" name="quantity" type="number" min={1} step={1} required className="w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Motivo</Label>
          <Input id="reason" name="reason" required className="w-56" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Registrar"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
