"use client";

import { useEffect, useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface CountdownTimerBlockProps {
  targetDate: string;
  displayFormat?: "full" | "compact";
  message?: string;
  redirectUrl?: string;
}

export function CountdownTimerBlock({
  props,
}: BlockComponentProps<CountdownTimerBlockProps>) {
  const {
    targetDate,
    displayFormat = "full",
    message,
    redirectUrl,
    style,
  } = props;
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setExpired(true);
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, redirectUrl]);

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "text-center",
    variantClasses[style?.variant || "default"],
  );

  if (expired) {
    return (
      <div className={blockClasses}>
        <p className="text-lg font-semibold">Time's up!</p>
        {message && <p className="mt-2 text-muted-foreground">{message}</p>}
      </div>
    );
  }

  if (!timeLeft) {
    return <div className={blockClasses}>Loading...</div>;
  }

  return (
    <div className={blockClasses}>
      {message && <p className="mb-4 text-lg">{message}</p>}
      <div
        className={cn(
          "flex justify-center gap-4",
          displayFormat === "compact" && "gap-2",
        )}
      >
        <div
          className={cn(
            "text-center",
            displayFormat === "compact" && "text-sm",
          )}
        >
          <div
            className={cn(
              "text-3xl font-bold",
              displayFormat === "compact" && "text-xl",
            )}
          >
            {timeLeft.days}
          </div>
          <div className="text-sm text-muted-foreground">Days</div>
        </div>
        <div
          className={cn(
            "text-center",
            displayFormat === "compact" && "text-sm",
          )}
        >
          <div
            className={cn(
              "text-3xl font-bold",
              displayFormat === "compact" && "text-xl",
            )}
          >
            {timeLeft.hours}
          </div>
          <div className="text-sm text-muted-foreground">Hours</div>
        </div>
        <div
          className={cn(
            "text-center",
            displayFormat === "compact" && "text-sm",
          )}
        >
          <div
            className={cn(
              "text-3xl font-bold",
              displayFormat === "compact" && "text-xl",
            )}
          >
            {timeLeft.minutes}
          </div>
          <div className="text-sm text-muted-foreground">Minutes</div>
        </div>
        <div
          className={cn(
            "text-center",
            displayFormat === "compact" && "text-sm",
          )}
        >
          <div
            className={cn(
              "text-3xl font-bold",
              displayFormat === "compact" && "text-xl",
            )}
          >
            {timeLeft.seconds}
          </div>
          <div className="text-sm text-muted-foreground">Seconds</div>
        </div>
      </div>
    </div>
  );
}
