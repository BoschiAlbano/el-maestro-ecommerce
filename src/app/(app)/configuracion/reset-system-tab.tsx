"use client";

import { useActionState, useState } from "react";
import { resetSystem, type ResetState } from "./sistema-actions";
import { RESET_PHRASE, type ResetSummary } from "@/lib/system-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const initialState: ResetState = {};

/** Pestaña "Sistema" (specs/017): reiniciar el sistema borrando todos los datos. Solo la ve el Dueño. */
export function ResetSystemTab({ summary }: { summary: ResetSummary }) {
  const [state, formAction, pending] = useActionState(resetSystem, initialState);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");

  const canSubmit = !pending && password.length > 0 && phrase.trim() === RESET_PHRASE;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive">Reiniciar el sistema</h2>
        <p className="text-sm">
          Borra <strong>todos los datos</strong> y deja el sistema como nuevo: solo quedan tu usuario, el rol Dueño y la
          configuración del negocio. También se borran los demás usuarios, los roles, las fotos de productos y el
          historial de auditoría.
        </p>
        <p className="text-sm font-medium">
          Esta acción es irreversible, y la base de datos es la misma que usa el sitio publicado.
        </p>
      </div>

      {summary.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-destructive">
          {summary.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Lo que se va a borrar</h3>
        <Table>
          <TableBody>
            {summary.rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <form action={formAction} className="flex max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-password">Tu contraseña</Label>
          <Input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-phrase">
            Para confirmar, escribí <span className="font-mono font-semibold">{RESET_PHRASE}</span>
          </Label>
          <Input
            id="reset-phrase"
            name="phrase"
            autoComplete="off"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            required
          />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.leftovers && state.leftovers.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-destructive">
            {state.leftovers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <Button type="submit" variant="destructive" disabled={!canSubmit} className="w-fit">
          {pending ? "Reiniciando..." : "Reiniciar el sistema"}
        </Button>
      </form>
    </div>
  );
}
