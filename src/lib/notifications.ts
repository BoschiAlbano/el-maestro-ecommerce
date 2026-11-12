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

/**
 * La conexión con Mercado Libre se cayó de forma definitiva y hay que volver
 * a conectar (specs/019, RF-5). No se repite mientras haya uno sin leer: la
 * renovación puede fallar muchas veces seguidas antes de que alguien lo vea.
 */
export async function notifyMlReconexion() {
  const open = await prisma.notification.findFirst({
    where: { type: "ML_RECONEXION", readAt: null },
    select: { id: true },
  });
  if (open) return;

  await prisma.notification.create({
    data: {
      type: "ML_RECONEXION",
      message: "Se perdió la conexión con Mercado Libre. Hay que volver a conectar la cuenta.",
      targetType: "MercadoLibreConnection",
      targetId: "singleton",
    },
  });
}

/**
 * Lo facturado en los últimos 12 meses cruzó el 80 % del tope del monotributo
 * (specs/023, RF-27). Es solo informativo: para que el dueño le avise al
 * contador. Nunca frena la facturación.
 */
export async function notifyTopeFacturacion(percent: number, accumulated: number, cap: number) {
  const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  await prisma.notification.create({
    data: {
      type: "TOPE_FACTURACION",
      message: `Ya facturaste ${money(accumulated)} en los últimos 12 meses: el ${percent} % del tope de ${money(cap)}. Avisale a tu contador.`,
      targetType: "FiscalConfig",
      targetId: "singleton",
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
