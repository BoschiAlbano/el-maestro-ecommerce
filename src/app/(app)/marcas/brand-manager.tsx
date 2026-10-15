"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBrand, deleteBrand, updateBrand, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Brand = { id: string; name: string };

const initialState: ActionState = {};

function BrandRow({ brand }: { brand: Brand }) {
  const [name, setName] = useState(brand.name);
  const [pending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className="max-w-xs"
        />
      </TableCell>
      <TableCell className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || name === brand.name}
          onClick={() => {
            startTransition(async () => {
              const result = await updateBrand(brand.id, name);
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
              const result = await deleteBrand(brand.id);
              if (result.error) toast.error(result.error);
            });
          }}
        >
          Borrar
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function BrandManager({ brands }: { brands: Brand[] }) {
  const [state, formAction, pending] = useActionState(createBrand, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex max-w-sm items-end gap-2">
        <Input name="name" placeholder="Nombre de la marca" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Agregar"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((brand) => (
            <BrandRow key={brand.id} brand={brand} />
          ))}
          {brands.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                Todavía no hay marcas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
