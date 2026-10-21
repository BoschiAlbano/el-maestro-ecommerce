"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_ROWS, PAGE_SIZE_OPTIONS } from "@/lib/page-size";

const ITEMS: Record<string, string> = {
  ...Object.fromEntries(PAGE_SIZE_OPTIONS.map((n) => [String(n), String(n)])),
  todos: "Todos",
};

/** Selector de filas por página: guarda la elección en `?porPagina=` y vuelve a la página 1. */
export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = pageSize >= ALL_ROWS ? "todos" : String(pageSize);

  function handleChange(next: string | null) {
    if (!next) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("porPagina", next);
    params.delete("pagina");
    router.push(`${pathname}?${params}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span id="page-size-label">Filas por página</span>
      <Select value={value} onValueChange={handleChange} items={ITEMS}>
        <SelectTrigger size="sm" className="w-20" aria-labelledby="page-size-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ITEMS).map(([val, label]) => (
            <SelectItem key={val} value={val}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
