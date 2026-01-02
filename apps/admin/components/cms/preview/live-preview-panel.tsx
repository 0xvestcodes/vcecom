"use client";

import { ExternalLink, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { CmsEntry } from "@/lib/types/cms";
import { cn } from "@/lib/utils";

interface LivePreviewPanelProps {
  entry?: CmsEntry | null;
  contentTypeName?: string;
  className?: string;
  onClose?: () => void;
  defaultOpen?: boolean;
}

/**
 * Live Preview Panel Component
 * Shows a live preview of the storefront with preview token support
 * Can be embedded in editors or used standalone
 */
export function LivePreviewPanel({
  entry,
  contentTypeName,
  className,
  onClose,
  defaultOpen = false,
}: LivePreviewPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const storefrontUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3002";

  // Generate preview token function - wrapped in useCallback to avoid dependency issues
  const generatePreviewToken = useCallback(async () => {
    if (!entry) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post(endpoints.cms.preview.generateToken, {
        entryId: entry.id,
        contentTypeId: entry.contentTypeId,
      });

      setPreviewToken((response as { token: string }).token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate preview token",
      );
      console.error("Failed to generate preview token:", err);
    } finally {
      setIsLoading(false);
    }
  }, [entry]);

  // Generate preview token when entry changes
  useEffect(() => {
    if (isOpen && entry) {
      generatePreviewToken();
    }
  }, [isOpen, entry?.id, entry, generatePreviewToken]);

  // Build preview URL
  const getPreviewUrl = (): string => {
    if (!entry || !previewToken) {
      return `${storefrontUrl}/preview?preview=true`;
    }

    // Determine the preview route based on content type
    let previewPath = "";
    if (contentTypeName === "page" && entry.slug) {
      previewPath = entry.slug === "home" ? "/" : `/${entry.slug}`;
    } else if (contentTypeName === "blog_post" && entry.slug) {
      previewPath = `/blog/${entry.slug}`;
    } else if (entry.slug) {
      previewPath = `/cms/${contentTypeName}/${entry.slug}`;
    } else {
      previewPath = `/cms/${contentTypeName}/preview/${entry.id}?token=${previewToken}`;
    }

    return `${storefrontUrl}${previewPath}?preview=true&previewToken=${previewToken}`;
  };

  // Send updates to iframe when entry changes (debounced)
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !entry || !previewToken) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const message = {
        type: "CMS_ENTRY_UPDATE",
        entryId: entry.id,
        entry,
        previewToken,
      };
      iframeRef.current?.contentWindow?.postMessage(message, "*");
    }, 500); // Debounce updates by 500ms

    return () => clearTimeout(timeoutId);
  }, [entry, previewToken]);

  // Handle fullscreen
  useEffect(() => {
    if (isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className={className}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open Preview
      </Button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col border rounded-lg bg-background shadow-lg",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Live Preview</h3>
          {entry && (
            <span className="text-xs text-muted-foreground">
              {entry.slug || entry.id}
            </span>
          )}
          {previewToken && (
            <span className="text-xs text-muted-foreground font-mono">
              {previewToken.substring(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            title="Close preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative bg-muted/30 min-h-[400px]">
        {isLoading && !previewToken && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Generating preview token...
              </p>
            </div>
          </div>
        )}
        {error && !previewToken && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-4">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button
                onClick={generatePreviewToken}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        {previewToken && (
          <iframe
            ref={iframeRef}
            src={getPreviewUrl()}
            className="w-full h-full border-0"
            title="Live Preview"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            allow="fullscreen"
          />
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-2 border-t bg-muted/50">
        <div className="text-xs text-muted-foreground">
          Preview mode: {previewToken ? "Active" : "Loading..."}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.src = getPreviewUrl();
              }
            }}
            disabled={!previewToken}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" asChild disabled={!previewToken}>
            <a href={getPreviewUrl()} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in New Tab
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
