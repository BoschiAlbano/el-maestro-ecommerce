import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

const ESTADOS: { value: string; label: string }[] = [
  { value: "__all__", label: "Todos" },
  { value: "bajo", label: "Bajo stock" },
  { value: "negativo", label: "Negativo" },
];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubroId?: string; estado?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver el inventario.</p>;
  }

  const { q, rubroId, estado } = await searchParams;

  const where: Prisma.ProductWhereInput = { active: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
    ];
  }
  if (rubroId && rubroId !== "__all__") where.rubroId = rubroId;
  if (estado === "negativo") where.currentStock = { lt: 0 };

  const [allMatching, topLevelRubros] = await Promise.all([
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
  ]);

  // "Bajo stock" compara dos columnas de la misma fila (currentStock vs.
  // minStock) — no se puede expresar en un `where` de Prisma, así que se
  // filtra en JS después de traer los productos (mismo criterio de escala
  // que el resto de la app, sin paginación).
  const products =
    estado === "bajo" ? allMatching.filter((p) => p.currentStock <= p.minStock) : allMatching;

  const rubroOptions = buildRubroOptions(topLevelRubros);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Stock</h1>
        <Link href="/inventario/conteo" className={cn(buttonVariants())}>
          Conteo físico
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Nombre o código</Label>
          <Input id="q" name="q" defaultValue={q} className="w-56" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rubroId">Rubro</Label>
          <Select
            name="rubroId"
            defaultValue={rubroId ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(rubroOptions.map((r) => [r.id, r.label])) }}
          >
            <SelectTrigger id="rubroId" className="w-56">
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
            <SelectTrigger id="estado" className="w-40">
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
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Historial</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const bajoStock = product.currentStock <= product.minStock;
            const negativo = product.currentStock < 0;
            return (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.currentStock}</TableCell>
                <TableCell>{product.minStock}</TableCell>
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
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No hay productos para estos filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
