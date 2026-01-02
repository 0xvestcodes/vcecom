"use client";

import { formatDistanceToNow } from "date-fns";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LockIndicatorProps {
  locked: boolean;
  lockedBy?: {
    id?: string;
    name?: string;
    email?: string;
  };
  expiresAt?: string;
  onTakeOver?: () => void;
  className?: string;
}

/**
 * User-friendly lock indicator
 * Shows "Shrey is editing..." with avatar instead of technical lock messages
 */
export function LockIndicator({
  locked,
  lockedBy,
  expiresAt,
  onTakeOver,
  className,
}: LockIndicatorProps) {
  if (!locked) {
    return null;
  }

  const isExpired = expiresAt && new Date(expiresAt).getTime() < Date.now();

  const userName =
    lockedBy?.name || lockedBy?.email?.split("@")[0] || "Someone";

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50",
        isExpired && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1">
        <div className="relative">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
            {initials}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-yellow-500 border-2 border-background flex items-center justify-center">
            <Lock className="h-2 w-2 text-yellow-900" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {userName} is editing this entry...
          </div>
          {expiresAt && !isExpired && (
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
            </div>
          )}
          {isExpired && (
            <div className="text-xs text-muted-foreground">Lock expired</div>
          )}
        </div>
      </div>
      {isExpired && onTakeOver && (
        <Button
          variant="outline"
          size="sm"
          onClick={onTakeOver}
          className="flex-shrink-0"
        >
          Take Over Editing
        </Button>
      )}
    </div>
  );
}
