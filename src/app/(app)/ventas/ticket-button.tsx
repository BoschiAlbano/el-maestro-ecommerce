"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TicketDialog } from "./ticket-dialog";

/** Botón que abre el ticket de una venta en una ventana modal (por ejemplo, desde un pedido). */
export function TicketButton({ saleId, label = "Ver ticket" }: { saleId: string; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="link" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <TicketDialog saleId={open ? saleId : null} onClose={() => setOpen(false)} />
    </>
  );
}
