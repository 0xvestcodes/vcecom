"use client";

import { CheckCheck } from "lucide-react";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/notifications/use-notifications";
import { FetchError } from "@/lib/api";
import { EmptyNotificationsState } from "./empty-notifications-state";
import { NotificationCard } from "./notification-card";

/**
 * Refactored Notifications List Client using universal components (L1 pattern)
 * Uses DataTable pattern but with custom card layout for notifications
 */
export function NotificationsListClientRefactored() {
  const { notifications, unreadCount, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return (
    <ListLayout
      title="Notifications"
      description="View and manage your notifications"
      createButton={
        unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="mr-2 h-3.5 w-3.5" />
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      <QueryState
        isLoading={isLoading}
        error={
          error instanceof Error && "status" in error
            ? (error as FetchError)
            : error
              ? new FetchError(
                  error instanceof Error ? error.message : "An error occurred",
                  500,
                )
              : null
        }
        data={notifications}
        emptyComponent={<EmptyNotificationsState />}
        onRetry={() => window.location.reload()}
      >
        <div className="space-y-6">
          {unreadNotifications.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Unread</h2>
                <Badge variant="secondary" className="text-xs">
                  {unreadNotifications.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {unreadNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markRead.mutate(notification.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {readNotifications.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Read</h2>
                <Badge variant="outline" className="text-xs">
                  {readNotifications.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {readNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markRead.mutate(notification.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </QueryState>
    </ListLayout>
  );
}
