"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { createRubro, deleteRubro, updateRubro, type ActionState } from "./actions";
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

type RubroNode = { id: string; name: string; children: { id: string; name: string }[] };

const initialState: ActionState = {};

function RubroRow({ rubro, indent }: { rubro: { id: string; name: string }; indent: boolean }) {
  const [name, setName] = useState(rubro.name);
  const [pending, startTransition] = useTransition();

  return (
    <div className={indent ? "ml-6 flex items-center gap-2" : "flex items-center gap-2"}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        className="max-w-xs"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending || name === rubro.name}
        onClick={() => {
          startTransition(async () => {
            const result = await updateRubro(rubro.id, name);
            if (result.error) toast.error(result.error);
          });
        }}
      >
        Guardar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await deleteRubro(rubro.id);
            if (result.error) toast.error(result.error);
          });
        }}
      >
        Borrar
      </Button>
    </div>
  );
}

export function RubroManager({ rubros }: { rubros: RubroNode[] }) {
  const [state, formAction, pending] = useActionState(createRubro, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex max-w-md flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" placeholder="Nombre del rubro o subrubro" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="parentId">Subrubro de (opcional)</Label>
          <Select
            name="parentId"
            defaultValue="__none__"
            items={{
              __none__: "Ninguno (rubro de primer nivel)",
              ...Object.fromEntries(rubros.map((r) => [r.id, r.name])),
            }}
          >
            <SelectTrigger id="parentId" className="w-full">
              <SelectValue placeholder="Ninguno (rubro de primer nivel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ninguno (rubro de primer nivel)</SelectItem>
              {rubros.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Creando..." : "Agregar"}
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        {rubros.map((rubro) => (
          <div key={rubro.id} className="flex flex-col gap-2">
            <RubroRow rubro={rubro} indent={false} />
            {rubro.children.map((child) => (
              <RubroRow key={child.id} rubro={child} indent />
            ))}
          </div>
        ))}
        {rubros.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay rubros.</p>
        )}
      </div>
    </div>
  );
}
