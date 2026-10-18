"use server";

import { getCurrentUser } from "@/lib/current-user";
import { loadNotificationsSummary, markNotificationRead, type NotificationsSummary } from "@/lib/notifications-data";

const EMPTY_SUMMARY: NotificationsSummary = { items: [], stockBajo: false, unreadCount: 0 };

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
