"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SaleRow = {
  id: string;
  ticketNumber: number;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  employee: string;
  total: number;
  voided: boolean;
  /** La caja de la venta: cuándo se abrió y si es la que está abierta ahora. */
  shift: { label: string; current: boolean };
};

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function SalesTable({ rows, emptyMessage, showShift }: { rows: SaleRow[]; emptyMessage: string; showShift: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Empleado</TableHead>
          {showShift && <TableHead>Caja</TableHead>}
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Detalle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="font-medium">#{sale.ticketNumber}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{sale.when}</TableCell>
            <TableCell>{sale.employee}</TableCell>
            {showShift && (
              <TableCell className="whitespace-nowrap">
                {sale.shift.current ? <Badge variant="outline">Actual</Badge> : <span className="text-muted-foreground">{sale.shift.label}</span>}
              </TableCell>
            )}
            <TableCell
              className={cn("text-right font-medium tabular-nums", sale.voided && "text-muted-foreground line-through")}
            >
              {formatMoney(sale.total)}
            </TableCell>
            <TableCell>
              <Badge variant={sale.voided ? "destructive" : "secondary"}>{sale.voided ? "Anulada" : "Activa"}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/ventas/historial/${sale.id}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Ver
              </Link>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={showShift ? 7 : 6} className="text-center text-sm text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export type SaleView = "todas" | "activas" | "anuladas";

const VIEW_EMPTY_MESSAGES: Record<SaleView, string> = {
  todas: "No hay ventas en este período.",
  activas: "No hay ventas activas en este período.",
  anuladas: "No hay ventas anuladas en este período.",
};

/**
 * Historial de ventas en pestañas: todas, activas y anuladas (specs/008, RF-13).
 * La pestaña vive en la URL (`?vista=`) y la lista llega ya filtrada y paginada
 * del servidor, así que los conteos (`counts`) son los del período completo.
 */
export function SaleHistoryTabs({
  sales,
  showShift,
  view,
  counts,
  hrefs,
}: {
  sales: SaleRow[];
  showShift: boolean;
  view: SaleView;
  counts: Record<SaleView, number>;
  hrefs: Record<SaleView, string>;
}) {
  const router = useRouter();

  return (
    <Tabs value={view} onValueChange={(value) => router.push(hrefs[value as SaleView])} className="gap-3">
      <TabsList>
        <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
        <TabsTrigger value="activas">Activas ({counts.activas})</TabsTrigger>
        <TabsTrigger value="anuladas">Anuladas ({counts.anuladas})</TabsTrigger>
      </TabsList>
      <TabsContent value={view}>
        <SalesTable rows={sales} showShift={showShift} emptyMessage={VIEW_EMPTY_MESSAGES[view]} />
      </TabsContent>
    </Tabs>
  );
}
