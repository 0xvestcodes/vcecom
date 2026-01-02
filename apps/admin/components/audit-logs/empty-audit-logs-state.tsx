"use client";

import { FileText } from "lucide-react";

export function EmptyAuditLogsState() {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No audit logs found</p>
      <p className="text-xs">
        Audit logs will appear here as administrative actions are performed
      </p>
    </div>
  );
}
