"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, PackageCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { deliverOrderItems } from "../actions";
import { PaymentDialog, type SalePayment } from "../../ventas/payment-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type PendingItem = { orderItemId: string; productName: string; salePrice: number; pending: number };

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Entrega de productos de un pedido (specs/009, RF-4 y RF-10): se elige cuánto
 * entregar de cada uno, y si queda algo por cobrar se pasa al mismo modal de
 * cobro de la pantalla de venta; si la seña cubre todo, se confirma directo.
 */
export function DeliverDialog({
  orderId,
  pendingItems,
  remainingDeposit,
}: {
  orderId: string;
  pendingItems: PendingItem[];
  remainingDeposit: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [delivering, startDeliver] = useTransition();

  const saleTotal = pendingItems.reduce((sum, item) => sum + (quantities[item.orderItemId] ?? 0) * item.salePrice, 0);
  const units = pendingItems.reduce((sum, item) => sum + (quantities[item.orderItemId] ?? 0), 0);
  const depositApplied = Math.min(Math.max(remainingDeposit, 0), saleTotal);
  const amountToCollect = saleTotal - depositApplied;

  function setQuantity(item: PendingItem, quantity: number) {
    setQuantities((prev) => ({ ...prev, [item.orderItemId]: Math.max(0, Math.min(item.pending, quantity)) }));
  }

  function deliver(payments: SalePayment[]) {
    const deliveries = pendingItems
      .map((item) => ({ orderItemId: item.orderItemId, quantity: quantities[item.orderItemId] ?? 0 }))
      .filter((d) => d.quantity > 0);

    startDeliver(async () => {
      const result = await deliverOrderItems(orderId, deliveries, amountToCollect > 0 ? payments : []);
      if (result.error || !result.saleId) {
        toast.error(result.error ?? "No se pudo registrar la entrega.");
        return;
      }
      setPaying(false);
      setOpen(false);
      setQuantities({});
      // El ticket se abre desde la URL: al entregar lo último del pedido este
      // componente deja de existir y un modal propio se cerraría solo.
      router.push(`/pedidos/${orderId}?venta=${result.saleId}`);
    });
  }

  function handleContinue() {
    if (units === 0) {
      toast.error("Elegí al menos un producto para entregar.");
      return;
    }
    if (amountToCollect > 0) {
      // Pasa al cobro; las cantidades quedan guardadas por si se cierra el cobro.
      setOpen(false);
      setPaying(true);
    } else {
      deliver([]);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button />}>
          <PackageCheck data-icon="inline-start" />
          Entregar
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entregar productos</DialogTitle>
            <DialogDescription>
              Elegí cuánto entregás ahora de cada producto. Se genera una venta con su ticket y se descuenta el stock.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuantities(Object.fromEntries(pendingItems.map((i) => [i.orderItemId, i.pending])))}
            >
              Entregar todo lo pendiente
            </Button>
          </div>

          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {pendingItems.map((item) => {
              const quantity = quantities[item.orderItemId] ?? 0;
              return (
                <li key={item.orderItemId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{item.productName}</span>
                    <span className="text-xs text-muted-foreground">
                      Pendiente: {item.pending} · {formatMoney(item.salePrice)} c/u
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Quitar una unidad de ${item.productName}`}
                      disabled={quantity <= 0}
                      onClick={() => setQuantity(item, quantity - 1)}
                    >
                      <Minus />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={item.pending}
                      step={1}
                      value={quantity}
                      aria-label={`Cantidad a entregar de ${item.productName}`}
                      onChange={(e) => setQuantity(item, Math.floor(Number(e.target.value)) || 0)}
                      className="h-7 w-14 text-center"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Agregar una unidad de ${item.productName}`}
                      disabled={quantity >= item.pending}
                      onClick={() => setQuantity(item, quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total de esta entrega</dt>
              <dd className="tabular-nums">{formatMoney(saleTotal)}</dd>
            </div>
            {depositApplied > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Se descuenta de la seña</dt>
                <dd className="tabular-nums">−{formatMoney(depositApplied)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>A cobrar</dt>
              <dd className="tabular-nums">{formatMoney(amountToCollect)}</dd>
            </div>
          </dl>

          <DialogFooter>
            <Button type="button" disabled={units === 0 || delivering} onClick={handleContinue}>
              {delivering ? "Entregando..." : amountToCollect > 0 ? "Continuar al cobro" : "Confirmar entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        total={amountToCollect}
        confirming={delivering}
        onConfirm={deliver}
        title="Cobrar entrega"
        totalLabel="Resto a cobrar"
        confirmLabel="Confirmar entrega"
        confirmingLabel="Entregando..."
      />
    </>
  );
}
