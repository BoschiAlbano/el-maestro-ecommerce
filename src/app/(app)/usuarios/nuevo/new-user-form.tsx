"use client";

import { useActionState } from "react";
import { createUser, type ActionState } from "../actions";
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

type NewUserFormProps = {
  roles: { id: string; name: string }[];
};

const initialState: ActionState = {};

export function NewUserForm({ roles }: NewUserFormProps) {
  const [state, formAction, pending] = useActionState(createUser, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Usuario</Label>
        <Input id="username" name="username" required minLength={3} maxLength={40} autoComplete="off" />
        <p className="text-xs text-muted-foreground">Con este nombre entra al sistema, por ejemplo El Maestro.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        <p className="text-xs text-muted-foreground">No se usa para ingresar.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña inicial</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="roleId">Rol</Label>
        <Select name="roleId" required items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}>
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
        {pending ? "Creando..." : "Crear usuario"}
      </Button>
    </form>
  );
}
