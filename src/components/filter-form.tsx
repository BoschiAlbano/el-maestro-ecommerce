"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Formulario de filtros de una lista (GET, por URL). En pantallas chicas deja visible
 * solo el buscador y esconde el resto detrás de un botón "Filtros"; en pantallas
 * grandes todo va en una sola fila.
 */
export function FilterForm({
  search,
  activeCount,
  toggleBelow = false,
  children = null,
}: {
  /** Campo de búsqueda: siempre visible. */
  search: ReactNode;
  /** Cuántos filtros de `children` están aplicados (se muestra en el botón y abre el panel). */
  activeCount: number;
  /** Pone el botón "Filtros" debajo del campo en vez de al lado (para campos anchos, como un rango de fechas). */
  toggleBelow?: boolean;
  /** Resto de los filtros (selects). Sin esto, no hay botón "Filtros": el buscador queda solo. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className={cn("flex gap-2 sm:items-end", toggleBelow ? "flex-col" : "items-end")}>
        <div className="min-w-0 flex-1 sm:flex-none">{search}</div>
        {children && (
        <Button
          type="button"
          variant="outline"
          className={cn("sm:hidden", toggleBelow && "w-full")}
          aria-expanded={open}
          aria-controls="filtros-extra"
          onClick={() => setOpen((value) => !value)}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} data-icon="inline-end" />
        </Button>
        )}
      </div>
      {children && (
      <div
        id="filtros-extra"
        className={cn("grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:contents", !open && "hidden")}
      >
        {children}
      </div>
      )}
      <Button type="submit" className="w-full sm:w-auto">
        Filtrar
      </Button>
    </form>
  );
}
