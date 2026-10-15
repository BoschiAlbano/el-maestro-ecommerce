"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRole } from "./actions";

export function DeleteRoleButton({ roleId, disabled }: { roleId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || pending}
      title={disabled ? "No se puede borrar un rol con usuarios asignados" : undefined}
      onClick={() => {
        startTransition(async () => {
          const result = await deleteRole(roleId);
          if (result.error) toast.error(result.error);
        });
      }}
    >
      Borrar
    </Button>
  );
}
