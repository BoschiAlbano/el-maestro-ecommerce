"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeOrderItem } from "../actions";
import { Button } from "@/components/ui/button";

export function RemoveItemButton({
  orderId,
  orderItemId,
  productName,
}: {
  orderId: string;
  orderItemId: string;
  productName: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await removeOrderItem(orderId, orderItemId);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Quitar ${productName} del pedido`}
      disabled={pending}
      onClick={handleClick}
    >
      <Trash2 />
    </Button>
  );
}
