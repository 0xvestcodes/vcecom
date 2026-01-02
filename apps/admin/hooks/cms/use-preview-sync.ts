"use client";

import { useEffect, useRef } from "react";
import { useAdminEntry } from "./use-admin-entries";

interface UsePreviewSyncOptions {
  entryId: string;
  enabled?: boolean;
  interval?: number; // Polling interval in milliseconds
  onUpdate?: () => void;
}

/**
 * Hook for syncing preview window with entry updates
 * Polls entry updates and refreshes preview iframe/window when changes are detected
 */
export function usePreviewSync({
  entryId,
  enabled: _enabled = true,
  interval: _interval = 2000, // Poll every 2 seconds
  onUpdate,
}: UsePreviewSyncOptions) {
  const { data: entry } = useAdminEntry(entryId);
  const previewWindowRef = useRef<Window | null>(null);
  const lastUpdatedRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track last updated timestamp
  useEffect(() => {
    if (entry?.updatedAt) {
      const updatedAt = new Date(entry.updatedAt);
      if (
        !lastUpdatedRef.current ||
        updatedAt.getTime() > lastUpdatedRef.current.getTime()
      ) {
        lastUpdatedRef.current = updatedAt;
        // Trigger update callback
        if (onUpdate) {
          onUpdate();
        }
        // Refresh preview window if open
        if (previewWindowRef.current && !previewWindowRef.current.closed) {
          try {
            previewWindowRef.current.location.reload();
          } catch (error) {
            // Cross-origin error - preview window might be on different domain
            // In this case, we can't reload it directly
            console.warn("Cannot reload preview window:", error);
          }
        }
      }
    }
  }, [entry?.updatedAt, onUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Open preview window and store reference
  const openPreview = (url: string) => {
    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      // If preview window is already open, just navigate it
      previewWindowRef.current.location.href = url;
      previewWindowRef.current.focus();
    } else {
      // Open new preview window
      previewWindowRef.current = window.open(url, "_blank");
    }
  };

  // Close preview window
  const closePreview = () => {
    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      previewWindowRef.current.close();
      previewWindowRef.current = null;
    }
  };

  return {
    openPreview,
    closePreview,
    isPreviewOpen:
      previewWindowRef.current !== null && !previewWindowRef.current.closed,
  };
}
