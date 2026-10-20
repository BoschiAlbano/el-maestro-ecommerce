import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const disabled = "pointer-events-none opacity-50";

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Mostrando {from}–{to} de {total}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              text="Anterior"
              href={buildHref(Math.max(1, page - 1))}
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
                <PaginationLink href={buildHref(p)} isActive={p === page}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              text="Siguiente"
              href={buildHref(Math.min(totalPages, page + 1))}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? disabled : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
