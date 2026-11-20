"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openPdf } from "./open-pdf";

/**
 * Descarga la etiqueta y la abre en otra pestaña para imprimirla (specs/022,
 * RF-16). Si Mercado Libre todavía no la tiene, o la orden no se puede
 * despachar, muestra el motivo en vez de una página de error.
 */
export function LabelButtons({ orderId, primary = true }: { orderId: string; primary?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"10x15" | "a4" | null>(null);

  async function open(format: "10x15" | "a4") {
    setPending(format);
    const opened = await openPdf(
      `/ordenes/${orderId}/etiqueta${format === "a4" ? "?formato=a4" : ""}`,
      "No se pudo descargar la etiqueta. Probá de nuevo.",
    );
    setPending(null);
    if (opened) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={primary ? "default" : "outline"} disabled={pending !== null} onClick={() => open("10x15")}>
        <Printer data-icon="inline-start" />
        {pending === "10x15" ? "Descargando..." : "Etiqueta 10 × 15"}
      </Button>
      <Button variant="outline" disabled={pending !== null} onClick={() => open("a4")}>
        {pending === "a4" ? "Descargando..." : "Etiqueta en hoja A4"}
      </Button>
    </div>
  );
}
