"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyListButton({ items }: { items: { name: string; suggested: number }[] }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const text =
      items.length === 0
        ? "No hay nada para comprar: ningún producto está por debajo del stock que necesitás."
        : items.map((item) => `${item.suggested} x ${item.name}`).join("\n");

    try {
      // Si el navegador nunca resuelve el permiso de portapapeles (pasa en
      // algunos navegadores/contextos), esto no puede quedar colgado sin
      // ningún aviso — por eso el timeout en vez de solo el `await`.
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Copiá el texto a mano desde la lista.");
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick}>
      {copied ? "¡Copiado!" : "Copiar lista"}
    </Button>
  );
}
