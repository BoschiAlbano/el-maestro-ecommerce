import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ModuloNegocio } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRubroOptions } from "@/lib/rubro-options";
import { loadTravelList } from "@/lib/home-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CopyListButton } from "./copy-list-button";
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
  searchParams: Promise<{ marca?: string; rubro?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasPermission(currentUser, ModuloNegocio.INVENTARIO, "ver")) {
    return <p className="text-sm text-muted-foreground">No tenés permiso para ver la lista de viaje.</p>;
  }

  const { marca, rubro } = await searchParams;
  const brandId = marca && marca !== "__all__" ? marca : undefined;
  const rubroId = rubro && rubro !== "__all__" ? rubro : undefined;

  const [items, brands, topLevelRubros] = await Promise.all([
    loadTravelList(currentUser, { brandId, rubroId }).then((list) => list ?? []),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.rubro.findMany({
      where: { parentId: null },
      include: { children: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const rubroOptions = buildRubroOptions(topLevelRubros);
  const queryString = new URLSearchParams(
    Object.entries({ marca: brandId, rubro: rubroId }).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lista de viaje</h1>
        <div className="flex gap-2">
          <CopyListButton items={items} />
          <Link
            href={`/lista-de-viaje/exportar${queryString ? `?${queryString}` : ""}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Exportar Excel
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="marca">Marca</Label>
          <Select
            name="marca"
            defaultValue={marca ?? "__all__"}
            items={{ __all__: "Todas", ...Object.fromEntries(brands.map((b) => [b.id, b.name])) }}
          >
            <SelectTrigger id="marca" className="w-48">
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
          <Label htmlFor="rubro">Rubro</Label>
          <Select
            name="rubro"
            defaultValue={rubro ?? "__all__"}
            items={{ __all__: "Todos", ...Object.fromEntries(rubroOptions.map((r) => [r.id, r.label])) }}
          >
            <SelectTrigger id="rubro" className="w-56">
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
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Disponible</TableHead>
            <TableHead>Sugerida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.available}</TableCell>
              <TableCell>{item.suggested}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                No hay nada para comprar: ningún producto está por debajo del stock que necesitás.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
