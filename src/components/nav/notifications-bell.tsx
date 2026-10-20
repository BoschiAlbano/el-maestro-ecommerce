"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { dismissStockAlertAction, getNotificationsSummary, markNotificationReadAction } from "./notifications-actions";
import type { NotificationsSummary } from "@/lib/notifications-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMPTY_SUMMARY: NotificationsSummary = { items: [], stockBajo: false, unreadCount: 0 };
const POLL_INTERVAL_MS = 60_000;

export function NotificationsBell() {
  const [summary, setSummary] = useState<NotificationsSummary>(EMPTY_SUMMARY);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      setSummary(await getNotificationsSummary());
    });
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function handleMarkRead(id: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (!result.error) setSummary(await getNotificationsSummary());
    });
  }

  function handleDismissStock() {
    startTransition(async () => {
      const result = await dismissStockAlertAction();
      if (!result.error) setSummary(await getNotificationsSummary());
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
          {summary.items.length === 0 && !summary.stockBajo && (
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
          {summary.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
              <span>{item.message}</span>
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
