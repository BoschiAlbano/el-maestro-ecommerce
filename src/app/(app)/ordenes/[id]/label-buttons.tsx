"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Descarga la etiqueta y la abre en otra pestaña para imprimirla (specs/022,
 * RF-16). Si Mercado Libre todavía no la tiene, o la orden no se puede
 * despachar, muestra el motivo en vez de una página de error.
 */
export function LabelButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"10x15" | "a4" | null>(null);

  async function open(format: "10x15" | "a4") {
    // La pestaña se abre ya, en el clic: si se abre después de esperar, el navegador la bloquea.
    const tab = window.open("", "_blank");
    setPending(format);
    try {
      const response = await fetch(`/ordenes/${orderId}/etiqueta${format === "a4" ? "?formato=a4" : ""}`);
      if (!response.ok) {
        tab?.close();
        toast.error(await response.text());
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      if (tab) tab.location.href = url;
      else window.location.href = url;
      router.refresh();
    } catch {
      tab?.close();
      toast.error("No se pudo descargar la etiqueta. Probá de nuevo.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending !== null} onClick={() => open("10x15")}>
        <Printer data-icon="inline-start" />
        {pending === "10x15" ? "Descargando..." : "Etiqueta 10 × 15"}
      </Button>
      <Button variant="outline" disabled={pending !== null} onClick={() => open("a4")}>
        {pending === "a4" ? "Descargando..." : "Etiqueta en hoja A4"}
      </Button>
    </div>
  );
}
