"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Eye, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CancelOrderDialog } from "./[id]/cancel-order-dialog";

export type OrderRow = {
  id: string;
  customerName: string;
  /** Ya formateada en horario de Tucumán. */
  when: string;
  items: number;
  status: "PENDIENTE" | "CERRADO" | "CANCELADO";
  /** Pendiente y con permiso de anular en Pedidos (specs/009, RF-11). */
  canCancel: boolean;
  /** Hay seña sin usar que se devolvería como egreso al cancelar. */
  hasDepositToReturn: boolean;
};

const STATUS_LABELS = { PENDIENTE: "Pendiente", CERRADO: "Cerrado", CANCELADO: "Cancelado" } as const;

/** Lista de pedidos con un menú de acciones por fila: ver el detalle o cancelar (specs/009, RF-11). */
export function OrdersTable({ orders, emptyMessage }: { orders: OrderRow[]; emptyMessage: string }) {
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Ítems</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                <Link href={`/pedidos/${order.id}`} className="hover:underline">
                  {order.customerName}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{order.when}</TableCell>
              <TableCell className="text-right tabular-nums">{order.items}</TableCell>
              <TableCell>
                <Badge
                  variant={order.status === "PENDIENTE" ? "secondary" : order.status === "CERRADO" ? "default" : "destructive"}
                >
                  {STATUS_LABELS[order.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Acciones del pedido de ${order.customerName}`} />}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem render={<Link href={`/pedidos/${order.id}`} />}>
                      <Eye />
                      Ver detalle
                    </DropdownMenuItem>
                    {order.canCancel && (
                      <DropdownMenuItem variant="destructive" onClick={() => setCancelTarget(order)}>
                        <Ban />
                        Cancelar pedido
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {cancelTarget && (
        <CancelOrderDialog
          key={cancelTarget.id}
          orderId={cancelTarget.id}
          hasDepositToReturn={cancelTarget.hasDepositToReturn}
          open
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
        />
      )}
    </>
  );
}
