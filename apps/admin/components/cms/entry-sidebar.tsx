"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, FileText, Link2, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentType, Entry } from "@/lib/types/cms";
import { cn } from "@/lib/utils";
import { LockIndicator } from "./lock-indicator";
import { PublishChecklist } from "./publish-checklist";
import { ReferenceGraph } from "./reference-graph";
import { TimelineView } from "./timeline-view";
import { WorkflowStatusIndicator } from "./workflow-status-indicator";

interface EntrySidebarProps {
  entry?: Entry;
  contentType?: ContentType;
  workflowStatus: "draft" | "review" | "published";
  isLocked: boolean;
  lockInfo?: {
    lockedBy?: string;
    lockType?: "hard" | "soft";
    expiresAt?: string;
  };
  publishReadiness?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  revisions?: Entry[]; // Backend returns Entry[] for revisions
  autosaveEvents?: Array<{ timestamp: Date }>;
  onPreviewSnapshot?: (revisionId?: string, snapshotId?: string) => void;
  onRestoreRevision?: (revisionId: string) => void;
  onTakeOverLock?: () => void;
  onFieldClick?: (fieldName: string) => void;
  className?: string;
}

/**
 * Entry Sidebar Component
 * Right sidebar with tabs for Status, Timeline, Publish Checklist, References, Revisions
 */
export function EntrySidebar({
  entry,
  contentType,
  workflowStatus,
  isLocked,
  lockInfo,
  publishReadiness,
  revisions = [],
  autosaveEvents = [],
  onPreviewSnapshot,
  onRestoreRevision,
  onTakeOverLock,
  onFieldClick,
  className,
}: EntrySidebarProps) {
  return (
    <div
      className={cn(
        "w-80 border-l bg-muted/30 flex flex-col h-full",
        className,
      )}
    >
      <Tabs defaultValue="status" className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
          <TabsTrigger value="status" className="text-xs">
            Status
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            Timeline
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid w-full grid-cols-2 m-4 mb-0 mt-2">
          <TabsTrigger value="checklist" className="text-xs">
            Checklist
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs">
            References
          </TabsTrigger>
        </TabsList>

        {/* Status Tab */}
        <TabsContent value="status" className="flex-1 overflow-hidden m-0 p-4">
          <div className="space-y-4 h-full overflow-y-auto">
            {/* Workflow Status */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Status</h3>
              <WorkflowStatusIndicator status={workflowStatus} variant="full" />
            </div>

            {/* Lock Status */}
            {isLocked && lockInfo && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Lock</h3>
                <LockIndicator
                  locked={isLocked}
                  lockedBy={
                    lockInfo.lockedBy
                      ? {
                          id: lockInfo.lockedBy,
                          name: lockInfo.lockedBy,
                        }
                      : undefined
                  }
                  expiresAt={lockInfo.expiresAt}
                  onTakeOver={onTakeOverLock}
                />
              </div>
            )}

            {/* Last Saved */}
            {entry?.updatedAt && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Last Saved</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            )}

            {/* Published Date */}
            {entry?.publishedAt && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Published</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.publishedAt), {
                    addSuffix: true,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(entry.publishedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent
          value="timeline"
          className="flex-1 overflow-hidden m-0 p-4"
        >
          <TimelineView
            entry={entry}
            revisions={revisions}
            autosaveEvents={autosaveEvents}
            onPreviewSnapshot={onPreviewSnapshot}
            onRestoreRevision={onRestoreRevision}
            className="h-full"
          />
        </TabsContent>

        {/* Publish Checklist Tab */}
        <TabsContent
          value="checklist"
          className="flex-1 overflow-hidden m-0 p-4"
        >
          {publishReadiness ? (
            <PublishChecklist
              valid={publishReadiness.valid}
              errors={publishReadiness.errors}
              warnings={publishReadiness.warnings}
              onItemClick={onFieldClick}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No publish readiness data available</p>
            </div>
          )}
        </TabsContent>

        {/* References Tab */}
        <TabsContent
          value="references"
          className="flex-1 overflow-hidden m-0 p-4"
        >
          <ReferenceGraph
            entry={entry}
            contentType={contentType}
            className="h-full"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
