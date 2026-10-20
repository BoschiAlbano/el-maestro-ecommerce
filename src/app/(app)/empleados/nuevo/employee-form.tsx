"use client";

import { useActionState, useState } from "react";
import { createEmployeeWithNewUser, createEmployeeForExistingUser, type ActionState } from "../actions";
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

const TURNOS = { MANANA: "Mañana", TARDE: "Tarde" };

function EmployeeFields() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="dni">DNI</Label>
        <Input id="dni" name="dni" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hireDate">Fecha de ingreso</Label>
        <Input id="hireDate" name="hireDate" type="date" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="shift">Turno</Label>
        <Select name="shift" required items={TURNOS} defaultValue="MANANA">
          <SelectTrigger id="shift" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANANA">Mañana</SelectItem>
            <SelectItem value="TARDE">Tarde</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

const initialState: ActionState = {};

function NewUserEmployeeForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeWithNewUser, initialState);

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
      <EmployeeFields />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear empleado"}
      </Button>
    </form>
  );
}

function ExistingUserEmployeeForm({
  availableUsers,
}: {
  availableUsers: { id: string; name: string; username: string }[];
}) {
  const [state, formAction, pending] = useActionState(createEmployeeForExistingUser, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="userId">Usuario</Label>
        <Select
          name="userId"
          required
          items={Object.fromEntries(availableUsers.map((u) => [u.id, `${u.name} (${u.username})`]))}
        >
          <SelectTrigger id="userId" className="w-full">
            <SelectValue placeholder="Elegí un usuario" />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <EmployeeFields />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear empleado"}
      </Button>
    </form>
  );
}

export function EmployeeForm({
  canCreateUser,
  roles,
  availableUsers,
}: {
  canCreateUser: boolean;
  roles: { id: string; name: string }[];
  availableUsers: { id: string; name: string; username: string }[];
}) {
  const [mode, setMode] = useState<"new" | "existing">(canCreateUser ? "new" : "existing");

  return (
    <div className="flex flex-col gap-4">
      {canCreateUser && (
        <div className="flex gap-2">
          <Button type="button" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
            Usuario nuevo
          </Button>
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => setMode("existing")}
          >
            Usuario existente
          </Button>
        </div>
      )}
      {mode === "new" && canCreateUser ? (
        <NewUserEmployeeForm roles={roles} />
      ) : (
        <ExistingUserEmployeeForm availableUsers={availableUsers} />
      )}
    </div>
  );
}
