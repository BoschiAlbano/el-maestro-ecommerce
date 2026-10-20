"use client";

import { useActionState } from "react";
import { updateUser, type ActionState } from "../actions";
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

type EditUserFormProps = {
  user: { id: string; name: string; email: string; roleId: string };
  roles: { id: string; name: string }[];
};

const initialState: ActionState = {};

export function EditUserForm({ user, roles }: EditUserFormProps) {
  const updateUserWithId = updateUser.bind(null, user.id);
  const [state, formAction, pending] = useActionState(updateUserWithId, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={user.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Usuario (email)</Label>
        <Input id="email" name="email" type="email" defaultValue={user.email} required />
        <p className="text-xs text-muted-foreground">Es el email con el que inicia sesión.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="roleId">Rol</Label>
        <Select
          name="roleId"
          defaultValue={user.roleId}
          required
          items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
        >
          <SelectTrigger id="roleId" className="w-full">
            <SelectValue placeholder="Elegí un rol" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
