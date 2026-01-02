"use client";

import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Save,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CMS_ACTION_LABELS } from "@/lib/constants/cms-actions.constants";
import type { AdminRole } from "@/lib/navigation";
import type { Entry, WorkflowStatus } from "@/lib/types/cms";
import { useAdminSession } from "@/providers/session-provider";

interface ContextActionBarProps {
  entry?: Entry;
  workflowStatus: WorkflowStatus;
  isEditMode: boolean;
  isLocked: boolean;
  lockInfo?: {
    lockType?: "hard" | "soft";
    expiresAt?: string;
  };
  autoSaveStatus?: "idle" | "saving" | "saved";
  contentTypeId: string;
  contentTypeName?: string; // Content type name (e.g., "page", "blog_post") for preview URLs
  onMoveToReview?: () => void;
  onSendBack?: () => void;
  onApproveAndPublish?: () => void;
  onUnpublish?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
  isMoveToReviewPending?: boolean;
  isSendBackPending?: boolean;
  isApprovePending?: boolean;
  isUnpublishPending?: boolean;
}

/**
 * Context-aware action bar component
 * Shows actions only when relevant based on entry status and user role
 */
export function ContextActionBar({
  entry,
  workflowStatus,
  isEditMode,
  isLocked,
  lockInfo,
  autoSaveStatus,
  contentTypeId,
  contentTypeName,
  onMoveToReview,
  onSendBack,
  onApproveAndPublish,
  onUnpublish,
  onSave,
  onDelete,
  isSubmitting = false,
  isMoveToReviewPending = false,
  isSendBackPending = false,
  isApprovePending = false,
  isUnpublishPending = false,
}: ContextActionBarProps) {
  const _router = useRouter();
  const { session } = useAdminSession();
  const userRole = (session?.role || "marketing") as AdminRole;

  const getPreviewUrl = useCallback(() => {
    if (!entry?.id) return "#";
    const storefrontUrl =
      process.env.NEXT_PUBLIC_STOREFRONT_PREVIEW_URL ||
      process.env.NEXT_PUBLIC_STOREFRONT_URL ||
      "http://localhost:3000";

    // Determine preview mode based on workflow status
    const mode =
      workflowStatus === "published"
        ? "published"
        : workflowStatus === "review"
          ? "review"
          : "draft";

    // Use content type specific preview route if available
    if (contentTypeName === "page" || contentTypeName === "pages") {
      return `${storefrontUrl}/cms/pages/preview/${entry.id}?mode=${mode}`;
    }
    if (contentTypeName === "blog_post" || contentTypeName === "blog") {
      return `${storefrontUrl}/cms/blog/preview/${entry.id}?mode=${mode}`;
    }

    // Fallback to generic preview route
    return `${storefrontUrl}/cms/preview/${entry.id}?mode=${mode}`;
  }, [entry, contentTypeName, workflowStatus]);

  const canReview = userRole === "admin" || userRole === "reviewer";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 flex-wrap bg-background border rounded-lg shadow-lg p-3">
      {/* Status and Lock Indicators */}
      {isEditMode && entry && (
        <>
          {isLocked && lockInfo && (
            <Badge variant="outline" className="mr-2">
              <Lock className="mr-1 h-3 w-3" />
              {lockInfo.lockType === "hard" ? "Locked" : "System Lock"}
              {lockInfo.expiresAt && (
                <span className="ml-1 text-xs">
                  (expires {new Date(lockInfo.expiresAt).toLocaleTimeString()})
                </span>
              )}
            </Badge>
          )}

          {workflowStatus === "draft" && !isLocked && autoSaveStatus && (
            <Badge variant="outline" className="mr-2">
              {autoSaveStatus === "saving" && "Saving..."}
              {autoSaveStatus === "saved" && "Saved"}
              {autoSaveStatus === "idle" && "Draft"}
            </Badge>
          )}
        </>
      )}

      {/* Back Button */}
      <Button variant="outline" asChild>
        <Link
          href={
            isEditMode
              ? `/cms/content-types/${contentTypeId}/entries`
              : "/cms/content-types"
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {CMS_ACTION_LABELS.back}
        </Link>
      </Button>

      {/* Context-Aware Actions */}
      {isEditMode && entry && (
        <>
          {/* Draft Status Actions */}
          {workflowStatus === "draft" && (
            <>
              {onMoveToReview && (
                <Button
                  variant="outline"
                  onClick={onMoveToReview}
                  disabled={isMoveToReviewPending || isLocked}
                  className="flex-shrink-0"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.submitForReview}
                </Button>
              )}
              {onSave && (
                <Button
                  onClick={onSave}
                  disabled={isSubmitting || isLocked}
                  className="flex-shrink-0"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.save}
                </Button>
              )}
              <Button variant="outline" asChild disabled={!entry.id}>
                <Link href={getPreviewUrl()} target="_blank">
                  <Eye className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.preview}
                </Link>
              </Button>
            </>
          )}

          {/* Review Status Actions */}
          {workflowStatus === "review" && canReview && (
            <>
              {onSendBack && (
                <Button
                  variant="outline"
                  onClick={onSendBack}
                  disabled={isSendBackPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.rejectReview}
                </Button>
              )}
              {onApproveAndPublish && (
                <Button
                  onClick={onApproveAndPublish}
                  disabled={isApprovePending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.approveAndPublish}
                </Button>
              )}
              <Button variant="outline" asChild disabled={!entry.id}>
                <Link href={getPreviewUrl()} target="_blank">
                  <Eye className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.preview}
                </Link>
              </Button>
            </>
          )}

          {/* Published Status Actions */}
          {workflowStatus === "published" && (
            <>
              {onUnpublish && (
                <Button
                  variant="outline"
                  onClick={onUnpublish}
                  disabled={isUnpublishPending}
                >
                  <EyeOff className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.unpublish}
                </Button>
              )}
              {onSave && (
                <Button
                  onClick={onSave}
                  disabled={isSubmitting || isLocked}
                  variant="outline"
                  className="flex-shrink-0"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.save}
                </Button>
              )}
              <Button variant="outline" asChild disabled={!entry.id}>
                <Link href={getPreviewUrl()} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {CMS_ACTION_LABELS.viewLive}
                </Link>
              </Button>
            </>
          )}

          {/* Delete Button (always available in edit mode) */}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {CMS_ACTION_LABELS.delete}
            </Button>
          )}
        </>
      )}

      {/* Create Mode Actions */}
      {!isEditMode && onSave && (
        <Button
          onClick={onSave}
          disabled={isSubmitting}
          className="flex-shrink-0"
        >
          <Save className="mr-2 h-4 w-4" />
          Create Entry
        </Button>
      )}
    </div>
  );
}
