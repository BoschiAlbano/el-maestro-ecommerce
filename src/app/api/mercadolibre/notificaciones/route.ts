import { after } from "next/server";
import { acceptNotifications, processPending, touchLastNotification } from "@/lib/mercadolibre/inbox-store";
import { isOurApplication, parseNotification } from "@/lib/mercadolibre/inbox";

// Recepción de los avisos de Mercado Libre (specs/019, RF-9 a RF-12; plan,
// sección 3.4). Es pública: no hay sesión, y su protección es que un aviso
// nunca se toma como dato (RF-10) y que se descartan los de otra aplicación o
// cuenta (RF-11).
//
// Mercado Libre exige un 200 en menos de 500 ms: acá se hace una sola
// escritura y el resto va después de responder, en `after`.
export const dynamic = "force-dynamic";

const ok = () => new Response(null, { status: 200 });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // No es un aviso. Se responde 200 igual para que no lo reintenten.
    return ok();
  }

  const notification = parseNotification(body);
  if (!notification) return ok();

  // Aplicación sin configurar o aviso de otra aplicación: no se guarda nada (RF-11).
  const clientId = process.env.ML_CLIENT_ID;
  if (!clientId || !isOurApplication(notification, clientId)) return ok();

  try {
    await acceptNotifications([notification], "WEBHOOK");
  } catch (error) {
    // 500 para que Mercado Libre reintente: sin guardar, el aviso se perdería.
    console.error("[mercadolibre] no se pudo guardar un aviso:", error instanceof Error ? error.name : "error");
    return new Response(null, { status: 500 });
  }

  after(async () => {
    try {
      await touchLastNotification(notification.mlUserId);
      await processPending();
    } catch (error) {
      // Lo que no se llegue a procesar queda pendiente para la pasada diaria.
      console.error("[mercadolibre] falló el procesamiento de avisos:", error instanceof Error ? error.name : "error");
    }
  });

  return ok();
}
