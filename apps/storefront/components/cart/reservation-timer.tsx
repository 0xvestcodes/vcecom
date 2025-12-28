"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ReservationTimerProps {
  expiresAt: Date | string | null;
  onExpire?: () => void;
}

/**
 * Reservation countdown timer component
 * Displays time remaining for cart reservation
 * Shows urgency colors (green → yellow → red)
 */
export function ReservationTimer({
  expiresAt,
  onExpire,
}: ReservationTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setIsExpired(true);
      return;
    }

    const updateTimer = () => {
      const expiryDate =
        typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
      const now = new Date();
      const remaining = Math.max(
        0,
        Math.floor((expiryDate.getTime() - now.getTime()) / 1000),
      );

      setTimeRemaining(remaining);
      setIsExpired(remaining === 0);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (!expiresAt || isExpired) {
    return (
      <Badge variant="destructive" className="text-xs">
        Reservation Expired
      </Badge>
    );
  }

  // Format time remaining as MM:SS
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Determine urgency color
  let variant: "default" | "secondary" | "destructive" = "default";
  if (timeRemaining < 60) {
    variant = "destructive"; // Red - less than 1 minute
  } else if (timeRemaining < 180) {
    variant = "secondary"; // Yellow - less than 3 minutes
  }

  return (
    <Badge variant={variant} className="text-xs">
      Reserved for {formattedTime}
    </Badge>
  );
}
