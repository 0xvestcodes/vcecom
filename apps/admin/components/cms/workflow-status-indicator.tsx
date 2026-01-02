"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { WorkflowStatus } from "@/lib/types/cms";
import { cn } from "@/lib/utils";

interface WorkflowStatusIndicatorProps {
  status: WorkflowStatus;
  variant?: "compact" | "full";
  className?: string;
  showTooltip?: boolean;
}

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    filledColor: "text-muted-foreground",
  },
  review: {
    label: "Review",
    color: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
    filledColor: "text-yellow-600 dark:text-yellow-500",
  },
  published: {
    label: "Published",
    color: "text-green-600 dark:text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/20",
    filledColor: "text-green-600 dark:text-green-500",
  },
} as const;

/**
 * Visual workflow progress indicator (Notion-style)
 * Shows: [● Draft] → [○ Review] → [○ Published]
 * Filled circle = current status, checkmark = completed statuses
 */
export function WorkflowStatusIndicator({
  status,
  variant = "full",
  className,
  showTooltip = true,
}: WorkflowStatusIndicatorProps) {
  const statuses: WorkflowStatus[] = ["draft", "review", "published"];
  const currentIndex = statuses.indexOf(status);

  if (variant === "compact") {
    const config = STATUS_CONFIG[status];
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
          config.bgColor,
          config.color,
          className,
        )}
        title={showTooltip ? `Status: ${config.label}` : undefined}
      >
        <Circle className="h-3 w-3 fill-current" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={
        showTooltip
          ? `Currently in ${STATUS_CONFIG[status].label}. ${
              currentIndex < statuses.length - 1
                ? `Next: ${STATUS_CONFIG[statuses[currentIndex + 1]].label}`
                : "Published"
            }`
          : undefined
      }
    >
      {statuses.map((s, index) => {
        const config = STATUS_CONFIG[s];
        const isCurrent = s === status;
        const isCompleted = index < currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div key={s} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {isCompleted ? (
                <CheckCircle2
                  className={cn("h-4 w-4", config.filledColor)}
                  aria-label={`${config.label} - completed`}
                />
              ) : isCurrent ? (
                <Circle
                  className={cn("h-4 w-4 fill-current", config.filledColor)}
                  aria-label={`${config.label} - current`}
                />
              ) : (
                <Circle
                  className={cn(
                    "h-4 w-4",
                    isUpcoming
                      ? "text-muted-foreground/30"
                      : "text-muted-foreground",
                  )}
                  aria-label={`${config.label} - upcoming`}
                />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  isCurrent
                    ? config.color
                    : isCompleted
                      ? "text-muted-foreground line-through"
                      : "text-muted-foreground/50",
                )}
              >
                {config.label}
              </span>
            </div>
            {index < statuses.length - 1 && (
              <span className="text-muted-foreground/30 text-sm">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
