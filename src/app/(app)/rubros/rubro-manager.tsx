"use client";

import { useActionState, useState, useTransition } from "react";
import { CornerDownRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { createRubro, deleteRubro, updateRubro, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type RubroItem = { id: string; name: string };
type RubroNode = RubroItem & { children: RubroItem[] };

const initialState: ActionState = {};

function RubroRow({
  rubro,
  isSub,
  onAddSub,
}: {
  rubro: RubroItem;
  isSub: boolean;
  /** Solo en rubros de primer nivel: abre el modal para agregarle un subrubro. */
  onAddSub?: () => void;
}) {
  const [name, setName] = useState(rubro.name);
  const [pending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell>
        <div className={isSub ? "ml-6 flex items-center gap-2" : "flex items-center gap-2"}>
          {isSub && <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className="max-w-xs"
            aria-label={isSub ? "Nombre del subrubro" : "Nombre del rubro"}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          {onAddSub && (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onAddSub}>
              <Plus data-icon="inline-start" />
              Subrubro
            </Button>
          )}
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
      </TableCell>
    </TableRow>
  );
}

/** Alta de un subrubro dentro de un rubro, en una ventana modal. */
function SubrubroDialog({ parent, onClose }: { parent: RubroItem | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parent) return;
    const formData = new FormData(event.currentTarget);
    formData.set("parentId", parent.id);
    startTransition(async () => {
      const result = await createRubro({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Subrubro agregado.");
      onClose();
    });
  }

  return (
    <Dialog
      open={parent !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        {/* key: que el campo arranque vacío cada vez que se abre para otro rubro */}
        <form key={parent?.id} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo subrubro</DialogTitle>
            <DialogDescription>Se agrega dentro del rubro «{parent?.name}».</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subrubroName">Nombre</Label>
            <Input id="subrubroName" name="name" autoFocus required placeholder="Nombre del subrubro" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando..." : "Agregar subrubro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RubroManager({ rubros }: { rubros: RubroNode[] }) {
  const [state, formAction, pending] = useActionState(createRubro, initialState);
  const [addTo, setAddTo] = useState<RubroItem | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <form action={formAction} className="flex max-w-sm items-end gap-2">
        <Input name="name" placeholder="Nombre del rubro" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Agregar"}
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rubros.flatMap((rubro) => [
            <RubroRow
              key={rubro.id}
              rubro={rubro}
              isSub={false}
              onAddSub={() => setAddTo({ id: rubro.id, name: rubro.name })}
            />,
            ...rubro.children.map((child) => <RubroRow key={child.id} rubro={child} isSub />),
          ])}
          {rubros.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                Todavía no hay rubros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      <SubrubroDialog parent={addTo} onClose={() => setAddTo(null)} />
    </div>
  );
}
