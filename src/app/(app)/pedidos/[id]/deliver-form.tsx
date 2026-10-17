"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deliverOrderItems } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type PendingItem = { orderItemId: string; productName: string; salePrice: number; pending: number };
type PaymentLine = { method: "EFECTIVO" | "TRANSFERENCIA"; amount: string; transferReference: string };

export function DeliverForm({
  orderId,
  pendingItems,
  remainingDeposit,
}: {
  orderId: string;
  pendingItems: PendingItem[];
  remainingDeposit: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [pending, startTransition] = useTransition();

  const saleTotal = useMemo(
    () =>
      pendingItems.reduce((sum, item) => sum + (quantities[item.orderItemId] ?? 0) * item.salePrice, 0),
    [pendingItems, quantities],
  );
  const depositApplied = Math.min(Math.max(remainingDeposit, 0), saleTotal);
  const amountToCollect = saleTotal - depositApplied;
  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  function addPayment() {
    setPayments((prev) => [...prev, { method: "EFECTIVO", amount: "", transferReference: "" }]);
  }

  function updatePayment(index: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const deliveries = pendingItems
      .map((item) => ({ orderItemId: item.orderItemId, quantity: quantities[item.orderItemId] ?? 0 }))
      .filter((d) => d.quantity > 0);

    if (deliveries.length === 0) {
      toast.error("Elegí al menos un producto para entregar.");
      return;
    }
    if (amountToCollect > 0 && Math.abs(paymentsTotal - amountToCollect) > 0.009) {
      toast.error(`Los pagos tienen que sumar exacto $${amountToCollect.toFixed(2)}.`);
      return;
    }
    for (const payment of payments) {
      if (payment.method === "TRANSFERENCIA" && !/^\d{4}$/.test(payment.transferReference)) {
        toast.error("Para transferencia, los últimos 4 dígitos del comprobante son obligatorios.");
        return;
      }
    }

    startTransition(async () => {
      const result = await deliverOrderItems(
        orderId,
        deliveries,
        amountToCollect > 0
          ? payments.map((p) => ({
              method: p.method,
              amount: Number(p.amount),
              transferReference: p.method === "TRANSFERENCIA" ? p.transferReference : undefined,
            }))
          : [],
      );
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Pendiente</TableHead>
            <TableHead>A entregar ahora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingItems.map((item) => (
            <TableRow key={item.orderItemId}>
              <TableCell>{item.productName}</TableCell>
              <TableCell>{item.pending}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  max={item.pending}
                  step={1}
                  value={quantities[item.orderItemId] ?? 0}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.orderItemId]: Math.max(0, Math.min(item.pending, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-20"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-1 text-sm">
        <p>Total de esta entrega: ${saleTotal.toFixed(0)}</p>
        {depositApplied > 0 && <p>Se aplica de la seña: ${depositApplied.toFixed(2)}</p>}
        <p className="font-semibold">A cobrar: ${amountToCollect.toFixed(2)}</p>
      </div>

      {amountToCollect > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Pagos</Label>
            <Button type="button" variant="outline" size="sm" onClick={addPayment}>
              Agregar pago
            </Button>
          </div>
          {payments.map((payment, index) => (
            <div key={index} className="flex items-end gap-2">
              <Select
                value={payment.method}
                onValueChange={(v) => updatePayment(index, { method: v as "EFECTIVO" | "TRANSFERENCIA" })}
                items={{ EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia" }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Monto"
                value={payment.amount}
                onChange={(e) => updatePayment(index, { amount: e.target.value })}
                className="w-28"
              />
              {payment.method === "TRANSFERENCIA" && (
                <Input
                  maxLength={4}
                  placeholder="4 dígitos"
                  value={payment.transferReference}
                  onChange={(e) => updatePayment(index, { transferReference: e.target.value })}
                  className="w-24"
                />
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => removePayment(index)}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" disabled={pending} onClick={handleSubmit} className="w-fit">
        {pending ? "Entregando..." : "Confirmar entrega"}
      </Button>
    </div>
  );
}
