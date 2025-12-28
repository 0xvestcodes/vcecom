"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActivityLog } from "@/lib/types/activity-logs";
import { cn } from "@/lib/utils";
import { ActivityLogContextViewer } from "./activity-log-context-viewer";

interface ActivityLogRowProps {
  log: ActivityLog;
}

export const getActionSeverity = (
  action: string,
): "default" | "secondary" | "destructive" => {
  if (
    action.includes("delete") ||
    action.includes("revoke") ||
    action.includes("fail")
  ) {
    return "destructive";
  }
  if (action.includes("login") || action.includes("create")) {
    return "default";
  }
  return "secondary";
};

export const getResourceColor = (
  resource: string | null,
): "default" | "secondary" | "outline" => {
  if (!resource) return "outline";
  const colors: Record<string, "default" | "secondary" | "outline"> = {
    product: "default",
    order: "secondary",
    customer: "secondary",
    discount: "outline",
    bundle: "outline",
    collection: "outline",
    category: "outline",
    auth: "secondary",
  };
  return colors[resource] || "outline";
};

export function ActivityLogRow({ log }: ActivityLogRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const truncateUserAgent = (userAgent: string | null, maxLength = 50) => {
    if (!userAgent) return "N/A";
    return userAgent.length > maxLength
      ? `${userAgent.substring(0, maxLength)}...`
      : userAgent;
  };

  return (
    <>
      <TableRow
        className={cn(
          "group cursor-pointer hover:bg-muted/30 transition-colors",
          isExpanded && "bg-muted/30",
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-10 text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs">
          {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
        </TableCell>
        <TableCell className="text-xs">
          <div className="flex flex-col">
            <span className="font-medium">{log.adminEmail || "Unknown"}</span>
            {log.ipAddress && (
              <span className="text-xs text-muted-foreground">
                {log.ipAddress}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-xs">
          <Badge variant={getActionSeverity(log.action)} className="text-xs">
            {log.action}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          {log.resource ? (
            <Badge variant={getResourceColor(log.resource)} className="text-xs">
              {log.resource}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {log.entityId || "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
          {truncateUserAgent(log.userAgent)}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    Admin ID:
                  </span>
                  <span className="ml-2 font-mono text-xs">{log.adminId}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    IP Address:
                  </span>
                  <span className="ml-2">{log.ipAddress || "N/A"}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">
                    User Agent:
                  </span>
                  <span className="ml-2 text-xs">{log.userAgent || "N/A"}</span>
                </div>
              </div>
              {log.metadata && (
                <ActivityLogContextViewer metadata={log.metadata} />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
