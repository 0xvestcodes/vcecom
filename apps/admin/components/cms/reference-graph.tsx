"use client";

import { ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentType, Entry } from "@/lib/types/cms";
import { cn } from "@/lib/utils";
import { WorkflowStatusIndicator } from "./workflow-status-indicator";

interface Reference {
  id: string;
  entryId: string;
  slug?: string | null;
  contentTypeId: string;
  contentTypeName?: string;
  displayName?: string;
  status?: "draft" | "review" | "published";
}

interface ReferenceGraphProps {
  entry?: Entry;
  contentType?: ContentType;
  references?: Reference[]; // Entries this entry references
  referencedBy?: Reference[]; // Entries that reference this entry
  isLoading?: boolean;
  className?: string;
}

/**
 * Reference Graph Component
 * Shows entry relationships: what this entry references and what references it
 */
export function ReferenceGraph({
  entry,
  contentType,
  references = [],
  referencedBy = [],
  isLoading = false,
  className,
}: ReferenceGraphProps) {
  // Extract references from entry data if not provided
  const extractedReferences: Reference[] = [];
  if (entry && contentType) {
    contentType.schema.fields.forEach((field) => {
      if (field.type === "relation") {
        const fieldValue = entry.data[field.name];
        if (fieldValue) {
          // Handle different relation value formats
          if (typeof fieldValue === "string") {
            // Single relation ID
            extractedReferences.push({
              id: fieldValue,
              entryId: fieldValue,
              contentTypeId: field.relationContentTypeId || "",
            });
          } else if (Array.isArray(fieldValue)) {
            // Multiple relations
            fieldValue.forEach((refId) => {
              if (typeof refId === "string") {
                extractedReferences.push({
                  id: refId,
                  entryId: refId,
                  contentTypeId: field.relationContentTypeId || "",
                });
              }
            });
          } else if (typeof fieldValue === "object" && fieldValue !== null) {
            // Object with id
            const refObj = fieldValue as { id?: string; entryId?: string };
            if (refObj.id || refObj.entryId) {
              extractedReferences.push({
                id: refObj.id || refObj.entryId || "",
                entryId: refObj.id || refObj.entryId || "",
                contentTypeId: field.relationContentTypeId || "",
              });
            }
          }
        }
      }
    });
  }

  const allReferences =
    references.length > 0 ? references : extractedReferences;

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const renderReferenceList = (
    refs: Reference[],
    _title: string,
    emptyMessage: string,
  ) => {
    if (refs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {refs.map((ref) => {
          const displayName =
            ref.displayName ||
            ref.slug ||
            `Entry ${ref.entryId.slice(0, 8)}...`;
          const workflowStatus =
            ref.status || ("draft" as "draft" | "review" | "published");

          return (
            <div
              key={ref.id}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    href={`/cms/entries/${ref.entryId}/edit`}
                    className="text-sm font-medium hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </Link>
                  {ref.contentTypeName && (
                    <Badge variant="outline" className="text-xs">
                      {ref.contentTypeName}
                    </Badge>
                  )}
                </div>
                <WorkflowStatusIndicator
                  status={workflowStatus}
                  variant="compact"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="flex-shrink-0"
              >
                <Link href={`/cms/entries/${ref.entryId}/edit`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* This Entry → References */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          This Entry → References
        </h3>
        <ScrollArea className="h-[200px]">
          {renderReferenceList(
            allReferences,
            "References",
            "This entry doesn't reference any other entries",
          )}
        </ScrollArea>
      </div>

      {/* Referenced By */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 rotate-180" />
          Referenced By
        </h3>
        <ScrollArea className="h-[200px]">
          {renderReferenceList(
            referencedBy,
            "Referenced By",
            "No other entries reference this entry",
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
