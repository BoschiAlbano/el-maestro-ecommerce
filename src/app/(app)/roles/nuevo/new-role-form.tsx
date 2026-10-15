"use client";

import { useActionState } from "react";
import { createRole, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionMatrix } from "@/components/permission-matrix";

const initialState: ActionState = {};

export function NewRoleForm() {
  const [state, formAction, pending] = useActionState(createRole, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="name">Nombre del rol</Label>
        <Input id="name" name="name" required />
      </div>

      <PermissionMatrix />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Creando..." : "Crear rol"}
      </Button>
    </form>
  );
}
