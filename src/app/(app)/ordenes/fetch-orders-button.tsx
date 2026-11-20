"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchOrdersNow } from "./actions";

/** «Buscar órdenes nuevas» (specs/022, RF-14). */
export function FetchOrdersButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await fetchOrdersNow();
          if (result.error) toast.error(result.error);
          else if (result.success) toast.success(result.success);
          router.refresh();
        })
      }
    >
      {pending ? "Buscando..." : "Buscar órdenes nuevas"}
    </Button>
  );
}
