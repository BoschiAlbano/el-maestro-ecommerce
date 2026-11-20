"use server";

import { getCurrentUser } from "@/lib/current-user";
import {
  dismissStockAlert,
  loadNotificationsSummary,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationsSummary,
} from "@/lib/notifications-data";
import type { NotificationTabFilter } from "@/lib/notification-tabs";

const EMPTY_SUMMARY: NotificationsSummary = { items: [], liveAlerts: [], stockBajo: false, unreadCount: 0, showTabs: false };
const TABS: readonly NotificationTabFilter[] = ["todos", "sistema", "mercadolibre"];

export async function getNotificationsSummary(): Promise<NotificationsSummary> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return EMPTY_SUMMARY;
  return loadNotificationsSummary(currentUser);
}

export async function markNotificationReadAction(id: string): Promise<{ error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No tenés permiso para esto." };
  return markNotificationRead(id, currentUser);
}

export async function dismissStockAlertAction(): Promise<{ error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No tenés permiso para esto." };
  return dismissStockAlert(currentUser);
}

/** «Marcar todas como leídas» en la pestaña abierta (specs/013, RF-11). */
export async function markAllNotificationsReadAction(tab: NotificationTabFilter): Promise<{ error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No tenés permiso para esto." };
  if (!TABS.includes(tab)) return { error: "La pestaña no existe." };
  return markAllNotificationsRead(currentUser, tab);
}
