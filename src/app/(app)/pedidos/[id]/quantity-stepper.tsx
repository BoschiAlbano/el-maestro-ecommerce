"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { updateOrderItemQuantity } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Cantidad pedida de un producto con "−" y "+" (specs/009, RF-2). No baja de 1
 * ni de lo ya entregado. El padre lo vuelve a montar (`key`) cuando cambia la
 * cantidad guardada, así siempre muestra lo que hay en el servidor.
 */
export function QuantityStepper({
  orderId,
  orderItemId,
  productName,
  quantity,
  delivered,
}: {
  orderId: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  delivered: number;
}) {
  const [draft, setDraft] = useState(String(quantity));
  const [pending, startTransition] = useTransition();
  const min = Math.max(1, delivered);

  function save(next: number) {
    if (next === quantity) {
      setDraft(String(quantity));
      return;
    }
    startTransition(async () => {
      const result = await updateOrderItemQuantity(orderId, orderItemId, next);
      if (result.error) {
        toast.error(result.error);
        setDraft(String(quantity));
      }
    });
  }

  function commitDraft() {
    const next = Math.floor(Number(draft));
    if (!Number.isFinite(next) || next < min) {
      if (Number.isFinite(next) && next < min) toast.error(`La cantidad mínima es ${min}.`);
      setDraft(String(quantity));
      return;
    }
    save(next);
  }

  return (
    <div className="ml-auto flex w-fit items-center gap-1">
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={`Quitar una unidad de ${productName}`}
        disabled={pending || quantity <= min}
        onClick={() => save(quantity - 1)}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        min={min}
        step={1}
        value={draft}
        disabled={pending}
        aria-label={`Cantidad pedida de ${productName}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          }
        }}
        className="h-7 w-14 text-center"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={`Agregar una unidad de ${productName}`}
        disabled={pending}
        onClick={() => save(quantity + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
