"use client";

import { useActionState, useEffect, useRef } from "react";
import { resetUserPassword, type PasswordActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordActionState = {};

export function ResetPasswordForm({ userId }: { userId: string }) {
  const resetWithId = resetUserPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState(resetWithId, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Repetir contraseña</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Contraseña cambiada.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Cambiando..." : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
