"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deactivateEmployee } from "../actions";
import { Button } from "@/components/ui/button";

export function DeactivateEmployeeButton({ employeeId }: { employeeId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deactivateEmployee(employeeId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConfirming(false);
    });
  }

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
        Dar de baja
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm">¿Dar de baja? No va a poder volver a iniciar sesión.</p>
      <Button type="button" variant="destructive" disabled={pending} onClick={handleConfirm}>
        {pending ? "Dando de baja..." : "Confirmar baja"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  );
}
