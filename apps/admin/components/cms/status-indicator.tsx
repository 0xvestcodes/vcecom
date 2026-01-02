"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CMS_STATUS_LABELS } from "@/lib/constants/cms-actions.constants";
import type { WorkflowStatus } from "@/lib/types/cms";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: WorkflowStatus;
  lastSaved?: Date;
  publishedAt?: Date;
  reviewer?: string;
  className?: string;
}

/**
 * Enhanced status indicator component
 * Shows status with contextual information (last saved, published date, etc.)
 */
export function StatusIndicator({
  status,
  lastSaved,
  publishedAt,
  reviewer,
  className,
}: StatusIndicatorProps) {
  const getStatusVariant = (status: WorkflowStatus) => {
    switch (status) {
      case "published":
        return "default"; // Green
      case "review":
        return "outline"; // Yellow/amber
      default:
        return "secondary"; // Gray
    }
  };

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case "published":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "review":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      default:
        return "";
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Badge
        variant={getStatusVariant(status)}
        className={cn(
          "px-3 py-1.5 text-sm font-medium",
          getStatusColor(status),
        )}
      >
        {CMS_STATUS_LABELS[status]}
      </Badge>

      {status === "draft" && lastSaved && (
        <span className="text-xs text-muted-foreground">
          Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
        </span>
      )}

      {status === "review" && reviewer && (
        <span className="text-xs text-muted-foreground">
          Review requested by {reviewer}
        </span>
      )}

      {status === "published" && publishedAt && (
        <span className="text-xs text-muted-foreground">
          Published {formatDistanceToNow(publishedAt, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}
