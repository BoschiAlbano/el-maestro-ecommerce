import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageSizeSelect } from "@/components/page-size-select";
import { ALL_ROWS, PAGE_SIZE_OPTIONS } from "@/lib/page-size";

/** Convierte el `?porPagina=` de la URL en un tamaño de página: 10, 15, 20 o todas las filas. */
export function parsePageSize(raw: string | undefined, fallback: number): number {
  if (raw === "todos") return ALL_ROWS;
  const n = Number.parseInt(raw ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

/** Convierte el `?pagina=` de la URL en un número de página válido (mínimo 1). */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Primera, última y la actual con sus vecinas; `null` es un hueco ("…"). */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

/**
 * Paginación de una lista armada con los componentes de shadcn. Navega por links
 * (`?pagina=N`), sin estado en el cliente; `buildHref` arma la URL de cada página
 * para que cada pantalla conserve sus otros filtros.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const disabled = "pointer-events-none opacity-50";
  // Cada link conserva el tamaño de página elegido.
  const sizeParam = pageSize >= ALL_ROWS ? "todos" : String(pageSize);
  const href = (p: number) => {
    const url = new URL(buildHref(p), "http://local");
    url.searchParams.set("porPagina", sizeParam);
    return url.pathname + url.search;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "Mostrando 0 de 0" : `Mostrando ${from}–${to} de ${total}`}
        </p>
        <PageSizeSelect pageSize={pageSize} />
      </div>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              text="Anterior"
              href={href(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={page <= 1 ? disabled : undefined}
            />
          </PaginationItem>
          {pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <PaginationItem key={`gap-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink href={href(p)} isActive={p === page}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              text="Siguiente"
              href={href(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? disabled : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
