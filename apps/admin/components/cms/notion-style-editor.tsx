"use client";

import { ReactNode } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import type { Entry, WorkflowStatus } from "@/lib/types/cms";
import { ContextActionBar } from "./context-action-bar";
import { StatusIndicator } from "./status-indicator";

interface NotionStyleEditorProps {
  title: string;
  description?: string;
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
  contentTypeDisplayName?: string;
  contentTypeName?: string; // Content type name (e.g., "page", "blog_post") for preview URLs
  lastSaved?: Date;
  publishedAt?: Date;
  reviewer?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
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
  children: ReactNode;
}

/**
 * Notion-style editor wrapper component
 * Provides a clean, document-like editing experience with:
 * - Full-width editor area
 * - Context-aware action bar
 * - Status indicator in header
 * - Minimal breadcrumb navigation
 */
export function NotionStyleEditor({
  title,
  description,
  entry,
  workflowStatus,
  isEditMode,
  isLocked,
  lockInfo,
  autoSaveStatus,
  contentTypeId,
  contentTypeDisplayName,
  contentTypeName,
  lastSaved,
  publishedAt,
  reviewer,
  breadcrumbs,
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
  children,
}: NotionStyleEditorProps) {
  // Build breadcrumbs if not provided
  const defaultBreadcrumbs = breadcrumbs || [
    { label: "CMS", href: "/cms/content-types" },
    ...(contentTypeDisplayName
      ? [
          {
            label: contentTypeDisplayName,
            href: `/cms/content-types/${contentTypeId}/entries`,
          },
        ]
      : []),
    { label: isEditMode ? "Edit" : "Create" },
  ];

  return (
    <AdminPageLayout
      title={title}
      description={description}
      breadcrumbs={defaultBreadcrumbs}
      actions={
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          {isEditMode && (
            <StatusIndicator
              status={workflowStatus}
              lastSaved={lastSaved}
              publishedAt={publishedAt}
              reviewer={reviewer}
            />
          )}
        </div>
      }
    >
      {/* Editor content with sidebar support */}
      <div className="flex h-[calc(100vh-200px)] overflow-hidden relative">
        {/* Main editor area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">{children}</div>
        </div>
        {/* Sidebar will be rendered by children if needed */}

        {/* Floating Action Bar */}
        <ContextActionBar
          entry={entry}
          workflowStatus={workflowStatus}
          isEditMode={isEditMode}
          isLocked={isLocked}
          lockInfo={lockInfo}
          autoSaveStatus={autoSaveStatus}
          contentTypeId={contentTypeId}
          contentTypeName={contentTypeName}
          onMoveToReview={onMoveToReview}
          onSendBack={onSendBack}
          onApproveAndPublish={onApproveAndPublish}
          onUnpublish={onUnpublish}
          onSave={onSave}
          onDelete={onDelete}
          isSubmitting={isSubmitting}
          isMoveToReviewPending={isMoveToReviewPending}
          isSendBackPending={isSendBackPending}
          isApprovePending={isApprovePending}
          isUnpublishPending={isUnpublishPending}
        />
      </div>
    </AdminPageLayout>
  );
}
