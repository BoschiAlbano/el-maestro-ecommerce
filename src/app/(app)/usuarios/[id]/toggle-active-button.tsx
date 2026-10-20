"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserActive } from "../actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  userId,
  userName,
  active,
  disabled,
}: {
  userId: string;
  userName: string;
  active: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await setUserActive(userId, !active);
      if (result.error) toast.error(result.error);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={active ? "destructive" : "default"}
        disabled={disabled || pending}
        onClick={active ? () => setOpen(true) : run}
      >
        {active ? "Desactivar usuario" : "Reactivar usuario"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Desactivar usuario?"
        description={`${userName} no va a poder iniciar sesión. Conserva su historial y lo podés reactivar cuando quieras.`}
        confirmLabel="Desactivar"
        pending={pending}
        onConfirm={run}
      />
    </>
  );
}
