"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restockOrder } from "../actions";

/** «Reingresar al stock» (specs/022, RF-20): no deja reingresar más de lo vendido. */
export function RestockForm({ orderId, items }: { orderId: string; items: { id: string; name: string; max: number }[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await restockOrder(orderId, quantities);
          if (result.error) toast.error(result.error);
          else {
            toast.success(result.success);
            setQuantities({});
            router.refresh();
          }
        });
      }}
    >
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-3">
          <Label htmlFor={`restock-${item.id}`} className="min-w-48 font-normal">
            {item.name} <span className="text-muted-foreground">(hasta {item.max})</span>
          </Label>
          <Input
            id={`restock-${item.id}`}
            type="number"
            min={0}
            max={item.max}
            step={1}
            value={quantities[item.id] ?? 0}
            onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Math.max(0, Math.min(item.max, Number(e.target.value) || 0)) }))}
            className="w-24"
          />
        </div>
      ))}
      <Button type="submit" className="w-fit" disabled={pending || Object.values(quantities).every((q) => q === 0)}>
        {pending ? "Reingresando..." : "Reingresar al stock"}
      </Button>
    </form>
  );
}
