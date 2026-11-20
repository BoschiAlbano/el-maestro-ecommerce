"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryOrderInvoiceAction } from "../actions";
import { openPdf } from "./open-pdf";

/** «Factura 10 × 15» y «Factura en hoja A4» (specs/024, RF-17). */
export function InvoicePrintButtons({ orderId, primary = false }: { orderId: string; primary?: boolean }) {
  const [pending, setPending] = useState<"10x15" | "a4" | null>(null);

  async function open(format: "10x15" | "a4") {
    setPending(format);
    await openPdf(`/ordenes/${orderId}/factura${format === "a4" ? "?formato=a4" : ""}`, "No se pudo descargar la factura. Probá de nuevo.");
    setPending(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={primary ? "default" : "outline"} disabled={pending !== null} onClick={() => open("10x15")}>
        <FileText data-icon="inline-start" />
        {pending === "10x15" ? "Descargando..." : "Factura 10 × 15"}
      </Button>
      <Button variant="outline" disabled={pending !== null} onClick={() => open("a4")}>
        {pending === "a4" ? "Descargando..." : "Factura en hoja A4"}
      </Button>
    </div>
  );
}

/** «Reintentar»: la autorización en ARCA o la subida a Mercado Libre (specs/024, RF-12 y RF-14). */
export function RetryInvoiceButton({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(async () => {
      const result = await retryOrderInvoiceAction(orderId);
      if ("error" in result) toast.error(result.error);
      else if (result.message) toast.error(result.message);
      else toast.success(result.state === "uploaded" ? "Listo: la factura está subida a Mercado Libre." : "Listo.");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={retry}>
      <RotateCw data-icon="inline-start" />
      {pending ? "Reintentando..." : label}
    </Button>
  );
}
