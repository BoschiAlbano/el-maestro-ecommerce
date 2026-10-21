"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SectionTab = { value: string; label: string; content: ReactNode };

/**
 * Pestañas para ordenar una pantalla en secciones (resumen, turnos, movimientos…).
 * El contenido llega ya armado desde el servidor.
 *
 * Los paneles son divs comunes (no los `TabsContent` de la librería): al
 * imprimir tienen que verse todos seguidos y sin la barra de pestañas — un
 * comprobante en papel no puede depender de cuál estaba abierta en pantalla — y
 * el atributo `hidden` de la librería no se puede anular desde CSS.
 */
export function SectionTabs({ tabs, defaultValue }: { tabs: SectionTab[]; defaultValue?: string }) {
  const [current, setCurrent] = useState(
    tabs.some((tab) => tab.value === defaultValue) ? (defaultValue as string) : (tabs[0]?.value ?? ""),
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Tabs value={current} onValueChange={(value) => setCurrent(String(value))} className="print:hidden">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          aria-label={tab.label}
          className={cn("flex flex-1 flex-col gap-4", tab.value !== current && "hidden print:flex")}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
