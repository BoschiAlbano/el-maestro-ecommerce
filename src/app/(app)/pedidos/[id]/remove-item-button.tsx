"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeOrderItem } from "../actions";
import { Button } from "@/components/ui/button";

export function RemoveItemButton({ orderId, orderItemId }: { orderId: string; orderItemId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await removeOrderItem(orderId, orderItemId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleClick}>
      Quitar
    </Button>
  );
}
