"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { reprintTicket } from "../ventas/actions";
import { TicketDialog } from "../ventas/ticket-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MovementRow = {
  id: string;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  type: "INGRESO" | "EGRESO";
  amount: number;
  concept: string;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA";
  transferReference: string | null;
  userName: string;
  /** La venta de la que viene el movimiento (cobro o devolución por anulación); null si es manual. */
  saleId: string | null;
};

type SaleActions = {
  canViewSales: boolean;
  canReprint: boolean;
  onReprint: (saleId: string) => void;
};

const METHOD_LABELS = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" } as const;

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/** Menú "Acciones" de un movimiento que viene de una venta (specs/007, RF-11). */
function MovementActions({ saleId, actions }: { saleId: string; actions: SaleActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Acciones" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {actions.canViewSales && (
          <DropdownMenuItem render={<Link href={`/ventas/historial/${saleId}`} />}>
            <Receipt />
            Ver venta
          </DropdownMenuItem>
        )}
        {actions.canReprint && (
          <DropdownMenuItem onClick={() => actions.onReprint(saleId)}>
            <Printer />
            Reimprimir ticket
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MovementsTable({
  rows,
  emptyMessage,
  actions,
}: {
  rows: MovementRow[];
  emptyMessage: string;
  actions: SaleActions;
}) {
  const showActions = actions.canViewSales || actions.canReprint;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Concepto</TableHead>
          <TableHead>Medio</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          {showActions && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{movement.when}</TableCell>
            <TableCell>
              <Badge variant={movement.type === "INGRESO" ? "secondary" : "destructive"}>
                {movement.type === "INGRESO" ? "Ingreso" : "Egreso"}
              </Badge>
            </TableCell>
            <TableCell className="max-w-64 truncate" title={movement.concept}>
              {movement.concept}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {METHOD_LABELS[movement.paymentMethod]}
              {movement.transferReference ? ` (••${movement.transferReference})` : ""}
            </TableCell>
            <TableCell>{movement.userName}</TableCell>
            <TableCell
              className={`text-right font-medium tabular-nums ${movement.type === "EGRESO" ? "text-destructive" : ""}`}
            >
              {movement.type === "INGRESO" ? "+" : "−"}
              {formatMoney(movement.amount)}
            </TableCell>
            {showActions && (
              <TableCell className="text-right">
                {movement.saleId && <MovementActions saleId={movement.saleId} actions={actions} />}
              </TableCell>
            )}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={showActions ? 7 : 6} className="text-center text-sm text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Movimientos del turno en pestañas: todos, ingresos y egresos (specs/007, RF-10). Los totales por medio de pago están arriba, en `CashSummaryCards`. */
export function MovementsTabs({
  movements,
  canViewSales,
  canReprint,
}: {
  movements: MovementRow[];
  canViewSales: boolean;
  canReprint: boolean;
}) {
  const [ticketSaleId, setTicketSaleId] = useState<string | null>(null);
  const [, startReprint] = useTransition();

  function handleReprint(saleId: string) {
    startReprint(async () => {
      const result = await reprintTicket(saleId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTicketSaleId(saleId);
    });
  }
  const actions: SaleActions = { canViewSales, canReprint, onReprint: handleReprint };
  const ingresos = movements.filter((m) => m.type === "INGRESO");
  const egresos = movements.filter((m) => m.type === "EGRESO");

  return (
    <Tabs defaultValue="todos" className="gap-3">
      <TabsList>
        <TabsTrigger value="todos">Todos ({movements.length})</TabsTrigger>
        <TabsTrigger value="ingresos">Ingresos ({ingresos.length})</TabsTrigger>
        <TabsTrigger value="egresos">Egresos ({egresos.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="todos">
        <MovementsTable rows={movements} emptyMessage="Todavía no hay movimientos en este turno." actions={actions} />
      </TabsContent>
      <TabsContent value="ingresos">
        <MovementsTable rows={ingresos} emptyMessage="Todavía no hay ingresos en este turno." actions={actions} />
      </TabsContent>
      <TabsContent value="egresos">
        <MovementsTable rows={egresos} emptyMessage="Todavía no hay egresos en este turno." actions={actions} />
      </TabsContent>
      <TicketDialog saleId={ticketSaleId} onClose={() => setTicketSaleId(null)} />
    </Tabs>
  );
}
