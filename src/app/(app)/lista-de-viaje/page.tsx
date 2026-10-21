import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { loadTravelList } from "@/lib/home-data";
import { Input } from "@/components/ui/input";
import { FilterForm } from "@/components/filter-form";
import { Label } from "@/components/ui/label";
import { PageActions } from "@/components/page-actions";
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

export default async function ListaDeViajePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brandId?: string; rubroId?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la lista de viaje.</p>;
  }

  const { q, brandId: brandParam, rubroId: rubroParam } = await searchParams;
  const query = q?.trim() || undefined;
  const brandId = brandParam && brandParam !== "__all__" ? brandParam : undefined;
  const rubroId = rubroParam && rubroParam !== "__all__" ? rubroParam : undefined;

  const [items, brands, topLevelRubros] = await Promise.all([
    loadTravelList(currentUser, { q: query, brandId, rubroId }).then((list) => list ?? []),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rubroOptions = buildRubroOptions(topLevelRubros);
  const queryString = new URLSearchParams(
    Object.entries({ q: query, brandId, rubroId }).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Lista de viaje</h1>
        <PageActions
          secondary={[
            {
              label: "Copiar lista",
              copyText:
                items.length === 0
                  ? "No hay nada para comprar: ningún producto está por debajo del stock que necesitás."
                  : items.map((item) => `${item.suggested} x ${item.name}`).join("\n"),
            },
            { label: "Exportar Excel", href: `/lista-de-viaje/exportar${queryString ? `?${queryString}` : ""}` },
          ]}
        />
      </div>

      <FilterForm
        activeCount={(brandParam ? 1 : 0) + (rubroParam ? 1 : 0)}
        search={
        <div className="flex flex-col gap-2">
          <Label htmlFor="q">Nombre o código</Label>
          <Input id="q" name="q" defaultValue={query} className="w-full sm:w-56" />
        </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="brandId">Marca</Label>
          <Select
            name="brandId"
            defaultValue={brandParam ?? "__all__"}
            items={{ __all__: "Todas", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
          >
            <SelectTrigger id="brandId" className="w-full sm:w-48">
              <SelectValue />
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
            defaultValue={rubroParam ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(rubroOptions.map((r) => [r.id, r.label])) }}
          >
            <SelectTrigger id="rubroId" className="w-full sm:w-56">
              <SelectValue />
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Stock mínimo</TableHead>
            <TableHead className="text-right">Pedido</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            <TableHead className="text-right">Sugerida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell className="text-right">{item.stock}</TableCell>
              <TableCell className="text-right">{item.minStock}</TableCell>
              <TableCell className="text-right">{item.committed}</TableCell>
              <TableCell className="text-right">{item.available}</TableCell>
              <TableCell className="text-right font-medium">{item.suggested}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No hay nada para comprar: ningún producto está por debajo del stock que necesitás.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
