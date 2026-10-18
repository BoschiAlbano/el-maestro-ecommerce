import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Avisos puntuales (specs/013) — no van dentro de la transacción de cada
 * flujo (ninguno de los dos orígenes usa `$transaction` hoy): un aviso
 * perdido por una falla puntual no es grave, a diferencia del dinero o el
 * stock (constitución, regla 10).
 */

export async function notifyPedidoNuevo(orderId: string, customerName: string) {
  await prisma.notification.create({
    data: {
      type: "PEDIDO_NUEVO",
      message: `Pedido nuevo de ${customerName}`,
      targetType: "Order",
      targetId: orderId,
    },
  });
}

export async function notifyDiferenciaCaja(shiftId: string, difference: number) {
  await prisma.notification.create({
    data: {
      type: "DIFERENCIA_CAJA",
      message: `Diferencia de $${Math.abs(Math.round(difference)).toLocaleString("es-AR")} al cerrar la caja`,
      targetType: "CashShift",
      targetId: shiftId,
    },
  });
}
