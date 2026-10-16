"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { previewCount, confirmCount, type PreviewCountState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = { id: string; name: string; currentStock: number };

const initialState: PreviewCountState = {};

export function CountWizard({ products }: { products: Product[] }) {
  const [state, formAction, pending] = useActionState(previewCount, initialState);
  const [confirmPending, startConfirm] = useTransition();
  const [applied, setApplied] = useState<number | null>(null);

  if (applied !== null) {
    return (
      <p className="text-sm">
        Se aplicaron {applied} ajuste{applied === 1 ? "" : "s"} del conteo.
      </p>
    );
  }

  const adjustments = state.adjustments;

  if (adjustments) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {adjustments.length === 0
            ? "No hay diferencias: el stock contado coincide con lo registrado."
            : `${adjustments.length} producto${adjustments.length === 1 ? "" : "s"} con diferencia.`}
        </p>
        {adjustments.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((a) => (
                  <TableRow key={a.productId}>
                    <TableCell>{a.productName}</TableCell>
                    <TableCell>{a.registered}</TableCell>
                    <TableCell>{a.counted}</TableCell>
                    <TableCell className={a.delta < 0 ? "text-destructive" : ""}>
                      {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              type="button"
              className="w-fit"
              disabled={confirmPending}
              onClick={() => {
                startConfirm(async () => {
                  const result = await confirmCount(adjustments);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    setApplied(result.applied ?? 0);
                  }
                });
              }}
            >
              {confirmPending ? "Aplicando..." : "Confirmar ajuste"}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Las cantidades ya vienen con el stock registrado — solo hace falta cambiar las que difieran de
        lo que contaste.
      </p>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Cantidad contada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>
                <Label htmlFor={`qty_${product.id}`} className="sr-only">
                  {product.name}
                </Label>
                <Input
                  id={`qty_${product.id}`}
                  name={`qty_${product.id}`}
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={product.currentStock}
                  className="w-24"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Calculando..." : "Previsualizar diferencias"}
      </Button>
    </form>
  );
}
