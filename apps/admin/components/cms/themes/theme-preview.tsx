"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemeSettingsDto } from "@/lib/types/themes";

interface ThemePreviewProps {
  themeId: string;
  settings: ThemeSettingsDto;
  previewToken?: string;
}

/**
 * Theme preview component
 * Embeds storefront in iframe with preview token and theme settings
 */
export function ThemePreview({
  themeId,
  settings,
  previewToken,
}: ThemePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const storefrontUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002";

  // Build preview URL with theme and preview token
  const previewUrl = `${storefrontUrl}/preview?preview=true&theme=${themeId}${previewToken ? `&previewToken=${previewToken}` : ""}`;

  // Send theme settings to iframe when they change
  useEffect(() => {
    if (iframeRef.current?.contentWindow && Object.keys(settings).length > 0) {
      const message = {
        type: "THEME_SETTINGS_UPDATE",
        themeId,
        settings,
      };
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
  }, [settings, themeId]);

  return (
    <div className="flex flex-col h-full border-l">
      <div className="p-4 border-b bg-muted/50">
        <h3 className="font-semibold text-sm">Live Preview</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Preview theme changes in real-time
        </p>
      </div>
      <div className="flex-1 relative bg-muted">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-muted-foreground">
              Loading preview...
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
          title="Theme Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
