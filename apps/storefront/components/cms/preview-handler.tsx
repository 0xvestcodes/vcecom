"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Preview Handler Component
 * Listens for preview updates from admin panel and handles preview mode
 */
export function PreviewHandler() {
  const searchParams = useSearchParams();
  const previewToken = searchParams.get("previewToken");
  const isPreview = searchParams.get("preview") === "true";

  useEffect(() => {
    if (!isPreview || !previewToken) return;

    // Listen for messages from admin panel
    const handleMessage = (event: MessageEvent) => {
      // Validate origin in production
      if (
        process.env.NODE_ENV === "production" &&
        !event.origin.includes(process.env.NEXT_PUBLIC_ADMIN_URL || "")
      ) {
        return;
      }

      // Handle CMS entry updates
      if (event.data?.type === "CMS_ENTRY_UPDATE") {
        const { entryId, entry, previewToken: messageToken } = event.data;

        // Verify token matches
        if (messageToken !== previewToken) {
          return;
        }

        // Trigger page refresh or update
        // For now, we'll reload the page to show updated content
        // In the future, we could do a more sophisticated update
        if (entryId && entry) {
          // Store entry update in sessionStorage for the page to use
          sessionStorage.setItem(
            `preview-entry-${entryId}`,
            JSON.stringify(entry),
          );

          // Dispatch custom event for components to listen to
          window.dispatchEvent(
            new CustomEvent("cms-entry-update", {
              detail: { entryId, entry },
            }),
          );
        }
      }

      // Handle theme settings updates (already handled by ThemeProvider)
      if (event.data?.type === "THEME_SETTINGS_UPDATE") {
        // This is handled by ThemeProvider component
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isPreview, previewToken]);

  // Show preview indicator
  if (isPreview && previewToken) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-yellow-900 px-3 py-2 rounded-lg shadow-lg text-xs font-medium">
        Preview Mode Active
      </div>
    );
  }

  return null;
}
