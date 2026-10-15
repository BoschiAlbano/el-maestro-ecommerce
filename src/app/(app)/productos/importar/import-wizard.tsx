"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { previewImport, confirmImport, type PreviewState } from "./actions";
import type { ParsedProductRow } from "@/lib/product-import";
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

const initialState: PreviewState = {};

export function ImportWizard() {
  const [state, formAction, pending] = useActionState(previewImport, initialState);
  const [confirmPending, startConfirm] = useTransition();
  const [confirmed, setConfirmed] = useState<number | null>(null);

  const rows = state.rows ?? [];
  const validRows = rows.filter((r) => r.status === "valid") as {
    status: "valid";
    rowNumber: number;
    data: ParsedProductRow;
  }[];
  const invalidRows = rows.filter((r) => r.status === "invalid") as {
    status: "invalid";
    rowNumber: number;
    errors: string[];
  }[];

  if (confirmed !== null) {
    return (
      <p className="text-sm">
        Se importaron {confirmed} producto{confirmed === 1 ? "" : "s"} correctamente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex items-end gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="file">Archivo (.xlsx o .csv)</Label>
          <Input id="file" name="file" type="file" accept=".xlsx,.csv" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Leyendo..." : "Previsualizar"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {validRows.length} fila{validRows.length === 1 ? "" : "s"} válida
            {validRows.length === 1 ? "" : "s"}, {invalidRows.length} con error
            {invalidRows.length === 1 ? "" : "es"}.
          </p>

          {invalidRows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalidRows.map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell>{r.rowNumber}</TableCell>
                    <TableCell className="text-sm text-destructive">
                      {r.errors.join(" ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {validRows.length > 0 && (
            <Button
              type="button"
              disabled={confirmPending}
              onClick={() => {
                startConfirm(async () => {
                  const result = await confirmImport(validRows.map((r) => r.data));
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    setConfirmed(result.created ?? 0);
                  }
                });
              }}
              className="w-fit"
            >
              {confirmPending
                ? "Importando..."
                : `Confirmar importación (${validRows.length} producto${validRows.length === 1 ? "" : "s"})`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
