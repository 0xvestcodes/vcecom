"use client";

import { Bell } from "lucide-react";

export function EmptyNotificationsState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No notifications</p>
      <p className="text-xs">
        You're all caught up! New notifications will appear here.
      </p>
    </div>
  );
}
