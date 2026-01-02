"use client";

import { Activity } from "lucide-react";

export function EmptyActivityLogsState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No activity logs found</p>
      <p className="text-xs">
        Activity logs will appear here as admins perform actions
      </p>
    </div>
  );
}
