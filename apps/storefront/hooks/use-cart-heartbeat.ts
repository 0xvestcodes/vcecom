"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { post } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

/**
 * Cart heartbeat hook
 * Sends heartbeat signal every 30 seconds to keep cart reservations alive
 * Stops automatically on page unload
 */
export function useCartHeartbeat(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnloadingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Mark as unloading when page is being unloaded
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Send initial heartbeat immediately
    const sendHeartbeat = async () => {
      if (isUnloadingRef.current) {
        return;
      }

      try {
        await post(endpoints.cart.heartbeat, {});
        // Optionally refresh cart data to get updated expiration times
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      } catch (error) {
        // Silently fail - heartbeat failures shouldn't break the UI
        console.debug("Cart heartbeat failed:", error);
      }
    };

    // Send heartbeat immediately
    sendHeartbeat();

    // Set up interval to send heartbeat every 30 seconds
    intervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, queryClient]);
}
