"use client";

import { useActionState } from "react";
import { updateEmployee, type ActionState } from "../actions";
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

const initialState: ActionState = {};

export function EditEmployeeForm({
  employeeId,
  dni,
  phone,
  hireDate,
  shift,
  disabled,
}: {
  employeeId: string;
  dni: string;
  phone: string;
  hireDate: string;
  shift: string;
  disabled: boolean;
}) {
  const action = updateEmployee.bind(null, employeeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="dni">DNI</Label>
        <Input id="dni" name="dni" defaultValue={dni} required disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input id="phone" name="phone" defaultValue={phone} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hireDate">Fecha de ingreso</Label>
        <Input id="hireDate" name="hireDate" type="date" defaultValue={hireDate} required disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="shift">Turno</Label>
        <Select name="shift" required defaultValue={shift} items={TURNOS} disabled={disabled}>
          <SelectTrigger id="shift" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANANA">Mañana</SelectItem>
            <SelectItem value="TARDE">Tarde</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending || disabled} className="w-fit">
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
