import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { computeCommittedQuantities } from "@/lib/order";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterForm } from "@/components/filter-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEFAULT_PAGE_SIZE = 20;

const ESTADOS: { value: string; label: string }[] = [
  { value: "__all__", label: "Todos" },
  { value: "bajo", label: "Bajo stock" },
  { value: "negativo", label: "Negativo" },
];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubroId?: string; estado?: string; pagina?: string; porPagina?: string }>;
}) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver el inventario.</p>;
  }

  const { q, rubroId, estado, pagina } = await searchParams;

  const where: Prisma.ProductWhereInput = { active: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
    ];
  }
  if (rubroId && rubroId !== "__all__") where.rubroId = rubroId;
  if (estado === "negativo") where.currentStock = { lt: 0 };

  const [allMatching, topLevelRubros, pendingOrderItems] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { id: true, name: true, currentStock: true, minStock: true },
      orderBy: { name: "asc" },
    }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: "PENDIENTE" } },
      select: { productId: true, quantityOrdered: true, quantityDelivered: true },
    }),
  ]);
  const committedByProduct = computeCommittedQuantities(pendingOrderItems);

  // "Bajo stock" compara dos columnas de la misma fila (currentStock vs.
  // minStock) — no se puede expresar en un `where` de Prisma, así que se
  // filtra en JS después de traer los productos (mismo criterio de escala
  // que el resto de la app, sin paginación).
  const products =
    estado === "bajo" ? allMatching.filter((p) => p.currentStock <= p.minStock) : allMatching;

  // Si la URL pide una página que no existe, se muestra la última.
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pagina), totalPages);
  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const rubroOptions = buildRubroOptions(topLevelRubros);

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Stock</h1>
        <Link href="/inventario/conteo" className={cn(buttonVariants())}>
          Conteo físico
        </Link>
      </div>

      <FilterForm
        activeCount={(rubroId && rubroId !== "__all__" ? 1 : 0) + (estado && estado !== "__all__" ? 1 : 0)}
        search={
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Nombre o código</Label>
          <Input id="q" name="q" defaultValue={q} className="w-full sm:w-56" />
        </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="rubroId">Rubro</Label>
          <Select
            name="rubroId"
            defaultValue={rubroId ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(rubroOptions.map((r) => [r.id, r.label])) }}
          >
            <SelectTrigger id="rubroId" className="w-full sm:w-56">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {rubroOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            name="estado"
            defaultValue={estado ?? "__all__"}
            items={Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]))}
          >
            <SelectTrigger id="estado" className="w-full sm:w-40">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>      </FilterForm>

      <div className="flex-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead>Comprometido</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Historial</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageProducts.map((product) => {
            const bajoStock = product.currentStock <= product.minStock;
            const negativo = product.currentStock < 0;
            return (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.currentStock}</TableCell>
                <TableCell>{product.minStock}</TableCell>
                <TableCell>{committedByProduct.get(product.id) ?? 0}</TableCell>
                <TableCell>
                  {negativo ? (
                    <Badge variant="destructive">Stock negativo — revisar</Badge>
                  ) : bajoStock ? (
                    <Badge variant="secondary">Bajo stock</Badge>
                  ) : (
                    <Badge variant="default">OK</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/inventario/${product.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    Ver
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No hay productos para estos filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(p) => {
          const query = new URLSearchParams();
          if (q) query.set("q", q);
          if (rubroId && rubroId !== "__all__") query.set("rubroId", rubroId);
          if (estado && estado !== "__all__") query.set("estado", estado);
          if (p > 1) query.set("pagina", String(p));
          const qs = query.toString();
          return qs ? `/inventario?${qs}` : "/inventario";
        }}
      />
    </div>
  );
}
