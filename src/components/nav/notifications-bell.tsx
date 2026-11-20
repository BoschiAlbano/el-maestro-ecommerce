"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { dismissStockAlertAction, getNotificationsSummary, markNotificationReadAction } from "./notifications-actions";
import type { NotificationsSummary } from "@/lib/notifications-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMPTY_SUMMARY: NotificationsSummary = { items: [], liveAlerts: [], stockBajo: false, unreadCount: 0 };
const POLL_INTERVAL_MS = 60_000;

/** Evento para que otra pantalla pida actualizar la campanita sin esperar la próxima vuelta (specs/020, RF-14b). */
export const REFRESH_NOTIFICATIONS_EVENT = "notifications:refresh";

export function requestNotificationsRefresh() {
  window.dispatchEvent(new Event(REFRESH_NOTIFICATIONS_EVENT));
}

export function NotificationsBell() {
  const [summary, setSummary] = useState<NotificationsSummary>(EMPTY_SUMMARY);
  const [pending, startTransition] = useTransition();

  // Los avisos son un extra de la pantalla: si una consulta falla (se cortó la red, el servidor se estaba
  // reiniciando, un túnel devolvió una respuesta incompleta), se conserva lo último que se vio y se vuelve a
  // intentar en la próxima vuelta. Un error acá nunca tiene que tumbar la página.
  async function loadSummary() {
    try {
      setSummary(await getNotificationsSummary());
    } catch {
      // se reintenta solo
    }
  }

  useEffect(() => {
    const poll = async () => {
      try {
        setSummary(await getNotificationsSummary());
      } catch {
        // se reintenta en la próxima vuelta
      }
    };
    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener(REFRESH_NOTIFICATIONS_EVENT, poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener(REFRESH_NOTIFICATIONS_EVENT, poll);
    };
  }, []);

  function handleMarkRead(id: string) {
    startTransition(async () => {
      try {
        const result = await markNotificationReadAction(id);
        if (!result.error) await loadSummary();
      } catch {
        // se reintenta al volver a tocar
      }
    });
  }

  function handleDismissStock() {
    startTransition(async () => {
      try {
        const result = await dismissStockAlertAction();
        if (!result.error) await loadSummary();
      } catch {
        // se reintenta al volver a tocar
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Avisos">
            <Bell className="size-4" />
            {summary.unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {summary.unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Avisos</p>
          {summary.items.length === 0 && summary.liveAlerts.length === 0 && !summary.stockBajo && (
            <p className="text-sm text-muted-foreground">No hay avisos nuevos.</p>
          )}
          {summary.stockBajo && (
            <div className="flex items-start justify-between gap-2 text-sm">
              <Link href="/lista-de-viaje" className="text-primary underline">
                Hay productos por debajo del stock que necesitás
              </Link>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDismissStock}>
                Marcar leído
              </Button>
            </div>
          )}
          {summary.liveAlerts.map((alert) => (
            <div key={alert.key} className="text-sm">
              <Link href={alert.href} className="text-primary underline">
                {alert.message}
              </Link>
            </div>
          ))}
          {summary.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
              {item.href ? (
                <Link href={item.href} className="text-primary underline">
                  {item.message}
                </Link>
              ) : (
                <span>{item.message}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => handleMarkRead(item.id)}
              >
                Marcar leído
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
