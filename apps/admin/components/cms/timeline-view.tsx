"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  History,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Entry } from "@/lib/types/cms";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type:
    | "created"
    | "autosave"
    | "submitted"
    | "approved"
    | "rejected"
    | "revision";
  timestamp: Date;
  user?: string;
  description: string;
  revisionId?: string;
  snapshotId?: string;
}

interface TimelineViewProps {
  entry?: Entry;
  revisions?: Entry[]; // Backend returns Entry[] for revisions
  autosaveEvents?: Array<{ timestamp: Date }>;
  onPreviewSnapshot?: (revisionId?: string, snapshotId?: string) => void;
  onRestoreRevision?: (revisionId: string) => void;
  className?: string;
}

/**
 * Timeline View Component
 * Shows unified timeline of entry history: autosaves, workflow transitions, revisions
 */
export function TimelineView({
  entry,
  revisions = [],
  autosaveEvents = [],
  onPreviewSnapshot,
  onRestoreRevision,
  className,
}: TimelineViewProps) {
  // Build timeline events from various sources
  const events: TimelineEvent[] = [];

  // Entry creation
  if (entry?.createdAt) {
    events.push({
      id: "created",
      type: "created",
      timestamp: new Date(entry.createdAt),
      user: entry.createdBy || undefined,
      description: "Entry created",
    });
  }

  // Published event
  if (entry?.publishedAt) {
    events.push({
      id: "published",
      type: "approved",
      timestamp: new Date(entry.publishedAt),
      user: entry.updatedBy || undefined,
      description: "Approved & published",
    });
  }

  // Autosave events (client-side tracked)
  autosaveEvents.forEach((event, index) => {
    events.push({
      id: `autosave-${index}`,
      type: "autosave",
      timestamp: event.timestamp,
      description: "Autosaved",
    });
  });

  // Revisions
  revisions.forEach((revision, index) => {
    events.push({
      id: revision.id,
      type: "revision",
      timestamp: new Date(revision.createdAt),
      user: revision.createdBy || undefined,
      description: `Revision #${revisions.length - index}`,
      revisionId: revision.id,
    });
  });

  // Sort by timestamp (newest first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return (
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        );
      case "autosave":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "submitted":
        return (
          <Send className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        );
      case "approved":
        return (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        );
      case "rejected":
        return (
          <Send className="h-4 w-4 text-red-600 dark:text-red-400 rotate-180" />
        );
      case "revision":
        return (
          <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        );
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventColor = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "created":
        return "border-blue-500";
      case "autosave":
        return "border-muted-foreground/30";
      case "submitted":
        return "border-yellow-500";
      case "approved":
        return "border-green-500";
      case "rejected":
        return "border-red-500";
      case "revision":
        return "border-purple-500";
      default:
        return "border-muted-foreground/30";
    }
  };

  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No timeline events yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[500px]", className)}>
      <div className="relative pl-8 space-y-4">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          return (
            <div key={event.id} className="relative">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 bg-background",
                  getEventColor(event.type),
                )}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {getEventIcon(event.type)}
                </div>
              </div>

              {/* Event content */}
              <div className="ml-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {event.description}
                      </span>
                      {event.user && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{event.user}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(event.timestamp, {
                        addSuffix: true,
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {event.revisionId && (
                      <>
                        {onPreviewSnapshot && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onPreviewSnapshot(
                                event.revisionId,
                                event.snapshotId,
                              )
                            }
                            className="h-7 text-xs"
                          >
                            Preview
                          </Button>
                        )}
                        {onRestoreRevision && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              event.revisionId &&
                              onRestoreRevision(event.revisionId)
                            }
                            className="h-7 text-xs"
                          >
                            Restore
                          </Button>
                        )}
                      </>
                    )}
                    {event.snapshotId && onPreviewSnapshot && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onPreviewSnapshot(undefined, event.snapshotId)
                        }
                        className="h-7 text-xs"
                      >
                        Preview
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector line (except for last item) */}
              {!isLast && (
                <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-border" />
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
