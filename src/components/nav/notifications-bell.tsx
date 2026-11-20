"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ClipboardList,
  FileText,
  PackageMinus,
  PlugZap,
  ShieldAlert,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  dismissStockAlertAction,
  getNotificationsSummary,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./notifications-actions";
import type { NotificationsSummary } from "@/lib/notifications-data";
import { inTab, relativeTime, tabCounts, type NotificationIcon, type NotificationTab, type NotificationTabFilter } from "@/lib/notification-tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMPTY_SUMMARY: NotificationsSummary = { items: [], liveAlerts: [], stockBajo: false, unreadCount: 0, showTabs: false };
const POLL_INTERVAL_MS = 60_000;

/** Evento para que otra pantalla pida actualizar la campanita sin esperar la próxima vuelta (specs/020, RF-14b). */
export const REFRESH_NOTIFICATIONS_EVENT = "notifications:refresh";

export function requestNotificationsRefresh() {
  window.dispatchEvent(new Event(REFRESH_NOTIFICATIONS_EVENT));
}

const ICONS: Record<NotificationIcon, LucideIcon> = {
  pedido: ClipboardList,
  caja: Wallet,
  stock: PackageMinus,
  factura: FileText,
  venta: ShoppingCart,
  cancelacion: Ban,
  fraude: ShieldAlert,
  envio: Truck,
  publicacion: Store,
  conexion: PlugZap,
};

const TAB_LABELS: Record<NotificationTabFilter, string> = { todos: "Todos", sistema: "Sistema", mercadolibre: "Mercado Libre" };
const EMPTY_LABELS: Record<NotificationTabFilter, string> = {
  todos: "No hay avisos.",
  sistema: "No hay avisos del sistema.",
  mercadolibre: "No hay avisos de Mercado Libre.",
};

/** Una fila de la lista, ya armada: un aviso calculado, el de stock bajo o uno guardado. */
type Row = {
  key: string;
  tab: NotificationTab;
  icon: NotificationIcon;
  urgent: boolean;
  message: string;
  href?: string;
  /** `null`: aviso calculado, va arriba con «Ahora» (RF-12). */
  createdAt: Date | null;
  onMarkRead?: () => void;
};

/**
 * La campanita (specs/013): avisos en pestañas Todos, Sistema y Mercado Libre
 * cuando el usuario ve Mercado Libre (sección 11), con ícono, hora y los
 * urgentes en rojo. Se actualiza sola cada 60 segundos.
 */
export function NotificationsBell() {
  const [summary, setSummary] = useState<NotificationsSummary>(EMPTY_SUMMARY);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTabFilter>("todos");
  const [now, setNow] = useState(() => new Date());
  const [pending, startTransition] = useTransition();

  // Los avisos son un extra de la pantalla: si una consulta falla (se cortó la red, el servidor se estaba
  // reiniciando, un túnel devolvió una respuesta incompleta), se conserva lo último que se vio y se vuelve a
  // intentar en la próxima vuelta. Un error acá nunca tiene que tumbar la página.
  async function loadSummary() {
    try {
      setSummary(await getNotificationsSummary());
      setNow(new Date());
    } catch {
      // se reintenta solo
    }
  }

  useEffect(() => {
    const poll = async () => {
      try {
        setSummary(await getNotificationsSummary());
        setNow(new Date());
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

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.error) await loadSummary();
      } catch {
        // se reintenta al volver a tocar
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setNow(new Date());
  }

  const rows: Row[] = [
    ...summary.liveAlerts.map((alert) => ({ ...alert, createdAt: null })),
    ...(summary.stockBajo
      ? [
          {
            key: "stock-bajo",
            tab: "sistema" as const,
            icon: "stock" as const,
            urgent: false,
            message: "Hay productos por debajo del stock que necesitás.",
            href: "/lista-de-viaje",
            createdAt: null,
            onMarkRead: () => run(dismissStockAlertAction),
          },
        ]
      : []),
    ...summary.items.map((item) => ({
      key: item.id,
      tab: item.tab,
      icon: item.icon,
      urgent: item.urgent,
      message: item.message,
      href: item.href,
      createdAt: new Date(item.createdAt),
      onMarkRead: () => run(() => markNotificationReadAction(item.id)),
    })),
  ];
  const counts = tabCounts(summary);
  const activeTab = summary.showTabs ? tab : "todos";
  const visible = rows.filter((row) => inTab(activeTab, row.tab));
  const canMarkAll = visible.some((row) => row.onMarkRead);

  const list = <NotificationList rows={visible} now={now} empty={EMPTY_LABELS[activeTab]} pending={pending} onNavigate={() => setOpen(false)} />;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={summary.unreadCount > 0 ? `Avisos: ${summary.unreadCount} sin leer` : "Avisos"}
          >
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
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Avisos</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={pending || !canMarkAll}
            onClick={() => run(() => markAllNotificationsReadAction(activeTab))}
          >
            <CheckCheck data-icon="inline-start" />
            Marcar todas como leídas
          </Button>
        </div>

        {summary.showTabs ? (
          <Tabs value={tab} onValueChange={(value) => setTab(value as NotificationTabFilter)} className="gap-0">
            <div className="border-b px-3 py-2">
              <TabsList className="w-full sm:w-full">
                {(Object.keys(TAB_LABELS) as NotificationTabFilter[]).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {TAB_LABELS[key]}
                    {counts[key] > 0 && (
                      <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] leading-4 tabular-nums">{counts[key]}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value={tab}>{list}</TabsContent>
          </Tabs>
        ) : (
          list
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  rows,
  now,
  empty,
  pending,
  onNavigate,
}: {
  rows: Row[];
  now: Date;
  empty: string;
  pending: boolean;
  onNavigate: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
        <BellOff className="size-5" aria-hidden />
        {empty}
      </div>
    );
  }
  return (
    <ul className="max-h-[min(28rem,65vh)] divide-y overflow-y-auto overscroll-contain">
      {rows.map((row) => (
        <NotificationRow key={row.key} row={row} now={now} pending={pending} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

function NotificationRow({ row, now, pending, onNavigate }: { row: Row; now: Date; pending: boolean; onNavigate: () => void }) {
  const Icon = ICONS[row.icon];
  const body = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          row.urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm leading-snug text-pretty", row.urgent && "font-medium text-destructive")}>{row.message}</span>
        {row.createdAt ? (
          <span className="text-xs text-muted-foreground">{relativeTime(row.createdAt, now)}</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">Ahora</span>
        )}
      </span>
    </>
  );

  return (
    <li className={cn("flex items-start gap-1 pr-2", row.urgent && "bg-destructive/5")}>
      {row.href ? (
        <Link
          href={row.href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4">{body}</div>
      )}
      {row.onMarkRead && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mt-2.5 shrink-0 text-muted-foreground"
          disabled={pending}
          onClick={row.onMarkRead}
          title="Marcar como leído"
          aria-label="Marcar como leído"
        >
          <Check />
        </Button>
      )}
    </li>
  );
}
