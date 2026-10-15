"use client";

import { useActionState } from "react";
// Desde "enums" (no desde "client"): ver nota en components/permission-matrix.tsx.
import { ModuloNegocio } from "@/generated/prisma/enums";
import { updateRole, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionMatrix } from "@/components/permission-matrix";
import type { Accion, PermisoEspecial } from "@/lib/permissions";

type EditRoleFormProps = {
  role: {
    id: string;
    name: string;
    permissions: ({ module: ModuloNegocio } & Record<Accion, boolean>)[];
  } & Record<PermisoEspecial, boolean>;
};

const initialState: ActionState = {};

export function EditRoleForm({ role }: EditRoleFormProps) {
  const updateRoleWithId = updateRole.bind(null, role.id);
  const [state, formAction, pending] = useActionState(updateRoleWithId, initialState);

  const defaultPermissions = Object.fromEntries(
    role.permissions.map((p) => [p.module, p]),
  ) as Partial<Record<ModuloNegocio, Record<Accion, boolean>>>;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="name">Nombre del rol</Label>
        <Input id="name" name="name" defaultValue={role.name} required />
      </div>

      <PermissionMatrix defaultPermissions={defaultPermissions} defaultSpecial={role} />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
