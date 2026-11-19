"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationsRefresh } from "@/components/nav/notifications-bell";

const INTERVAL_MS = 60_000;

/**
 * La pantalla de publicaciones se actualiza sola cada 60 segundos y al volver
 * a la pestaña, y con el botón «Actualizar» (specs/020, RF-14b). Cada vez
 * actualiza la tabla y también la campanita, que si no esperaría su propia
 * vuelta de 60 segundos. Con la pestaña oculta no pide nada.
 */
export function AutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      requestNotificationsRefresh();
    };
    const timer = window.setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(() => router.refresh());
        requestNotificationsRefresh();
      }}
    >
      <RefreshCw data-icon="inline-start" className={pending ? "animate-spin" : undefined} />
      {pending ? "Actualizando..." : "Actualizar"}
    </Button>
  );
}
