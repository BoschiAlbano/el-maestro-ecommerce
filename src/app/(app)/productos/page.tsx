import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, hasSpecialPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { CatalogTabs } from "@/components/catalog-tabs";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageActions } from "@/components/page-actions";
import { FilterForm } from "@/components/filter-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TablePagination, parsePage, parsePageSize } from "@/components/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEFAULT_PAGE_SIZE = 20;

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brandId?: string; rubroId?: string; pagina?: string; porPagina?: string }>;
}) {
  const PAGE_SIZE = parsePageSize((await searchParams).porPagina, DEFAULT_PAGE_SIZE);
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.CATALOGO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver el catálogo.</p>;
  }

  const verCostos = hasSpecialPermission(currentUser, "verCostosMargenes");
  const { q, brandId, rubroId, pagina } = await searchParams;

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
    ];
  }
  if (brandId && brandId !== "__all__") where.brandId = brandId;
  if (rubroId && rubroId !== "__all__") where.rubroId = rubroId;

  const total = await prisma.product.count({ where });

  // Si la URL pide una página que no existe (p. ej. ?pagina=99), se muestra la última.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(pagina), totalPages);

  const [products, brands, topLevelRubros] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { brand: true, rubro: { include: { parent: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rubroOptions = buildRubroOptions(topLevelRubros);

  return (
    <div className="flex min-h-[calc(100svh-5.5rem)] flex-col gap-4">
      <CatalogTabs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Productos</h1>
        <PageActions
          primary={
            <Link href="/productos/nuevo" className={cn(buttonVariants())}>
              Nuevo producto
            </Link>
          }
          secondary={[
            { href: "/productos/etiquetas", label: "Etiquetas" },
            { href: "/productos/importar", label: "Importar" },
          ]}
        />
      </div>

      <FilterForm
        activeCount={(brandId && brandId !== "__all__" ? 1 : 0) + (rubroId && rubroId !== "__all__" ? 1 : 0)}
        search={
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Nombre o código</Label>
          <Input id="q" name="q" defaultValue={q} className="w-full sm:w-56" />
        </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="brandId">Marca</Label>
          <Select
            name="brandId"
            defaultValue={brandId ?? "__all__"}
            items={{ __all__: "Todas", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
          >
            <SelectTrigger id="brandId" className="w-full sm:w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        </div>      </FilterForm>

      {/* flex-1: la tabla ocupa el alto sobrante y la paginación queda siempre al pie. */}
      <div className="flex-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Rubro</TableHead>
            <TableHead>Código</TableHead>
            {verCostos && <TableHead>Compra</TableHead>}
            <TableHead>Venta</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.brand?.name ?? "—"}</TableCell>
              <TableCell>
                {product.rubro.parent ? `${product.rubro.parent.name} > ${product.rubro.name}` : product.rubro.name}
              </TableCell>
              <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
              {verCostos && <TableCell>${product.purchasePrice.toFixed(0)}</TableCell>}
              <TableCell>${product.salePrice.toFixed(0)}</TableCell>
              <TableCell>
                <Badge variant={product.active ? "default" : "secondary"}>
                  {product.active ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/productos/${product.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Editar
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={verCostos ? 8 : 7} className="text-center text-sm text-muted-foreground">
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
          if (brandId && brandId !== "__all__") query.set("brandId", brandId);
          if (rubroId && rubroId !== "__all__") query.set("rubroId", rubroId);
          if (p > 1) query.set("pagina", String(p));
          const qs = query.toString();
          return qs ? `/productos?${qs}` : "/productos";
        }}
      />
    </div>
  );
}
