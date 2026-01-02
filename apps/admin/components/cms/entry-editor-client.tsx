"use client";

import { AlertTriangle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { QueryState } from "@/components/common/query-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContentType } from "@/hooks/cms/use-admin-content-types";
import { useAdminCreateEntry } from "@/hooks/cms/use-admin-create-entry";
import { useAdminDeleteEntry } from "@/hooks/cms/use-admin-delete-entry";
import {
  useAdminEntry,
  useAdminEntryRevisions,
} from "@/hooks/cms/use-admin-entries";
import {
  useAdminPublishEntry,
  useAdminUnpublishEntry,
} from "@/hooks/cms/use-admin-publish-entry";
import { useAdminRestoreRevision } from "@/hooks/cms/use-admin-restore-revision";
import { useAdminUpdateEntry } from "@/hooks/cms/use-admin-update-entry";
import {
  useAdminAcquireLock,
  useAdminApproveAndPublish,
  useAdminEntryLock,
  useAdminPublishReadiness,
  useAdminRejectReview,
  useAdminReleaseLock,
  useAdminSubmitForReview,
} from "@/hooks/cms/use-admin-workflow";
import { CMS_ACTION_LABELS } from "@/lib/constants/cms-actions.constants";
import type { EntryStatus, WorkflowStatus } from "@/lib/types/cms";
import { EntrySidebar } from "./entry-sidebar";
import { FieldRenderer } from "./field-renderer";
import { NotionStyleEditor } from "./notion-style-editor";

interface EntryEditorClientProps {
  entryId?: string;
  contentTypeId?: string;
}

/**
 * Client component for entry editor
 * Handles both create and edit modes with dynamic form generation
 */
export function EntryEditorClient({
  entryId,
  contentTypeId: propContentTypeId,
}: EntryEditorClientProps) {
  const _router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [revisionToRestore, setRevisionToRestore] = useState<string | null>(
    null,
  );
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<Date | null>(null);
  const [autosaveEvents, setAutosaveEvents] = useState<
    Array<{ timestamp: Date }>
  >([]);
  const isEditMode = !!entryId;

  // Fetch entry if editing
  const { data: entry, isLoading: isLoadingEntry } = useAdminEntry(
    entryId || "",
  );
  const contentTypeId = propContentTypeId || entry?.contentTypeId || "";

  // Fetch content type for schema
  const { data: contentType, isLoading: isLoadingContentType } =
    useAdminContentType(contentTypeId);

  // Fetch revisions if editing
  const { data: revisions } = useAdminEntryRevisions(entryId || "");

  // Workflow hooks (only in edit mode)
  const lockQuery = useAdminEntryLock(entryId || "");
  const publishReadinessQuery = useAdminPublishReadiness(entryId || "");
  const submitForReviewMutation = useAdminSubmitForReview(
    entryId || "",
    contentTypeId,
  );
  const approveMutation = useAdminApproveAndPublish(
    entryId || "",
    contentTypeId,
  );
  const rejectMutation = useAdminRejectReview(entryId || "", contentTypeId);
  const acquireLockMutation = useAdminAcquireLock(entryId || "");
  const releaseLockMutation = useAdminReleaseLock(entryId || "");

  // Mutations
  const createMutation = useAdminCreateEntry(contentTypeId);
  const updateMutation = useAdminUpdateEntry(entryId || "", contentTypeId);
  const publishMutation = useAdminPublishEntry(entryId || "", contentTypeId);
  const unpublishMutation = useAdminUnpublishEntry(
    entryId || "",
    contentTypeId,
  );
  const deleteMutation = useAdminDeleteEntry(contentTypeId);
  const restoreMutation = useAdminRestoreRevision(entryId || "", contentTypeId);

  // Initialize form with entry data or defaults (no status field - workflow managed via actions)
  const defaultValues = useMemo(() => {
    if (entry && contentType) {
      const values: Record<string, unknown> = {
        slug: entry.slug || "",
      };
      // Populate form with entry data
      for (const field of contentType.schema.fields) {
        values[field.name] = entry.data[field.name] ?? field.default ?? "";
      }
      return values;
    }
    if (contentType) {
      const values: Record<string, unknown> = {
        slug: "",
      };
      // Populate form with defaults
      for (const field of contentType.schema.fields) {
        values[field.name] = field.default ?? "";
      }
      return values;
    }
    return { slug: "" };
  }, [entry, contentType]);

  const form = useForm({
    defaultValues,
    mode: "onChange",
  });

  // Update form when entry loads
  useEffect(() => {
    if (entry && contentType) {
      const values: Record<string, unknown> = {
        slug: entry.slug || "",
      };
      for (const field of contentType.schema.fields) {
        values[field.name] = entry.data[field.name] ?? field.default ?? "";
      }
      form.reset(values);
    }
  }, [entry, contentType, form]);

  // Track if we're currently acquiring a lock to prevent spam
  const acquiringLockRef = useRef(false);

  // Auto-acquire lock when editing
  useEffect(() => {
    if (
      isEditMode &&
      entryId &&
      lockQuery.data &&
      !lockQuery.data.locked &&
      !acquiringLockRef.current &&
      !acquireLockMutation.isPending
    ) {
      acquiringLockRef.current = true;
      acquireLockMutation.mutate(undefined, {
        onSettled: () => {
          acquiringLockRef.current = false;
        },
      });
    }
  }, [
    isEditMode,
    entryId,
    lockQuery.data?.locked,
    acquireLockMutation.mutate,
    acquireLockMutation.isPending,
    lockQuery.data,
  ]);

  // Auto-refresh lock on user activity
  useEffect(() => {
    if (!isEditMode || !entryId || !lockQuery.data?.locked) return;

    const handleActivity = () => {
      // Refresh lock every 2 minutes on activity
      const now = new Date();
      if (
        !lastSaveRef.current ||
        (now.getTime() - lastSaveRef.current.getTime() > 120000 &&
          !acquiringLockRef.current &&
          !acquireLockMutation.isPending)
      ) {
        acquiringLockRef.current = true;
        acquireLockMutation.mutate(undefined, {
          onSettled: () => {
            acquiringLockRef.current = false;
          },
        });
        lastSaveRef.current = now;
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [
    isEditMode,
    entryId,
    lockQuery.data?.locked,
    acquireLockMutation.isPending,
    acquireLockMutation.mutate,
  ]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (isEditMode && entryId && lockQuery.data?.locked) {
        releaseLockMutation.mutate();
      }
    };
  }, [isEditMode, entryId, lockQuery.data?.locked, releaseLockMutation.mutate]);

  // Get workflow status (needed before useEffects that use it)
  const workflowStatus: WorkflowStatus =
    entry?.currentWorkflowStatus || entry?.status || "draft";
  const isLocked = lockQuery.data?.locked || false;
  const lockInfo = lockQuery.data;

  // Auto-save functionality for draft entries
  useEffect(() => {
    if (!isEditMode || !entryId || workflowStatus !== "draft" || isLocked) {
      return;
    }

    const subscription = form.watch((value) => {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set auto-save status to saving
      setAutoSaveStatus("saving");

      // Debounce auto-save (2 seconds)
      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const { slug, ...entryData } = value as Record<string, unknown>;
          await updateMutation.mutateAsync({
            data: entryData,
            slug: slug as string,
          });
          setAutoSaveStatus("saved");
          // Track autosave event for timeline
          setAutosaveEvents((prev) => [
            { timestamp: new Date() },
            ...prev.slice(0, 49), // Keep last 50 events
          ]);
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        } catch (error) {
          setAutoSaveStatus("idle");
          console.error("Auto-save failed:", error);
        }
      }, 2000);
    });

    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [isEditMode, entryId, workflowStatus, isLocked, form, updateMutation]);

  const handleSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      const { slug, ...entryData } = data;

      if (isEditMode && entryId) {
        await updateMutation.mutateAsync({
          data: entryData,
          slug: slug as string,
        });
      } else {
        await createMutation.mutateAsync({
          data: entryData,
          slug: slug as string,
          status: "draft" as EntryStatus, // New entries always start as draft
        });
      }
    },
    [isEditMode, entryId, updateMutation, createMutation],
  );

  const handleSubmitForReview = useCallback(async () => {
    if (!entryId) return;
    await submitForReviewMutation.mutateAsync();
  }, [entryId, submitForReviewMutation]);

  const handleMoveToReview = handleSubmitForReview;

  const handleApprove = useCallback(async () => {
    if (!entryId) return;
    await approveMutation.mutateAsync();
  }, [entryId, approveMutation]);

  const handleReject = useCallback(async () => {
    if (!entryId) return;
    await rejectMutation.mutateAsync();
  }, [entryId, rejectMutation]);

  const handleSendBack = handleReject;

  const _handlePublish = useCallback(async () => {
    if (!entryId) return;
    await publishMutation.mutateAsync();
  }, [entryId, publishMutation]);

  const handleUnpublish = useCallback(async () => {
    if (!entryId) return;
    await unpublishMutation.mutateAsync();
  }, [entryId, unpublishMutation]);

  const handleDelete = useCallback(() => {
    if (!entryId) return;
    deleteMutation.mutate(entryId, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
      },
    });
  }, [entryId, deleteMutation]);

  const handleRestoreRevision = useCallback(() => {
    if (!entryId || !revisionToRestore) return;
    restoreMutation.mutate(revisionToRestore, {
      onSuccess: () => {
        setRestoreDialogOpen(false);
        setRevisionToRestore(null);
      },
    });
  }, [entryId, revisionToRestore, restoreMutation]);

  const handleSave = useCallback(() => {
    form.handleSubmit(handleSubmit)();
  }, [form, handleSubmit]);

  const isLoading = isLoadingEntry || isLoadingContentType;
  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    submitForReviewMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;

  if (isLoading) {
    return <EntryEditorSkeleton />;
  }

  if (!contentType) {
    return (
      <NotionStyleEditor
        title="Content Type Not Found"
        workflowStatus="draft"
        isEditMode={false}
        isLocked={false}
        contentTypeId={contentTypeId}
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content type not found. Please check the URL.
          </p>
        </div>
      </NotionStyleEditor>
    );
  }

  return (
    <>
      <NotionStyleEditor
        title={isEditMode ? "Edit Entry" : "Create Entry"}
        description={`${isEditMode ? "Edit" : "Create"} a new ${contentType.displayName.toLowerCase()}`}
        entry={entry}
        workflowStatus={workflowStatus}
        isEditMode={isEditMode}
        isLocked={isLocked}
        lockInfo={lockInfo}
        autoSaveStatus={autoSaveStatus}
        contentTypeId={contentTypeId}
        contentTypeDisplayName={contentType.displayName}
        contentTypeName={contentType.name}
        lastSaved={entry?.updatedAt ? new Date(entry.updatedAt) : undefined}
        publishedAt={
          entry?.publishedAt ? new Date(entry.publishedAt) : undefined
        }
        onMoveToReview={isEditMode ? handleMoveToReview : undefined}
        onSendBack={isEditMode ? handleSendBack : undefined}
        onApproveAndPublish={isEditMode ? handleApprove : undefined}
        onUnpublish={isEditMode ? handleUnpublish : undefined}
        onSave={handleSave}
        onDelete={isEditMode ? () => setDeleteDialogOpen(true) : undefined}
        isSubmitting={isSubmitting}
        isMoveToReviewPending={submitForReviewMutation.isPending}
        isSendBackPending={rejectMutation.isPending}
        isApprovePending={approveMutation.isPending}
        isUnpublishPending={unpublishMutation.isPending}
      >
        <QueryState
          isLoading={false}
          error={null}
          data={contentType}
          loadingComponent={<EntryEditorSkeleton />}
        >
          <div className="flex h-full">
            {/* Main editor content */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-6">
                {/* Publish Readiness Warnings */}
                {isEditMode && entryId && publishReadinessQuery.data && (
                  <>
                    {publishReadinessQuery.data.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Cannot Publish</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            {publishReadinessQuery.data.errors.map(
                              (error, idx) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: Error list, order is stable and items don't change
                                <li key={`error-${idx}`}>{error}</li>
                              ),
                            )}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {publishReadinessQuery.data.warnings.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Publish Warnings</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            {publishReadinessQuery.data.warnings.map(
                              (warning, idx) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: Warning list, order is stable and items don't change
                                <li key={`warning-${idx}`}>{warning}</li>
                              ),
                            )}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {/* Lock Warning */}
                {isEditMode && entryId && isLocked && lockInfo && (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Entry is Locked</AlertTitle>
                    <AlertDescription>
                      {lockInfo.lockType === "hard"
                        ? "This entry is currently being edited by another user. You may not be able to save changes."
                        : "This entry is locked by a system operation. Please wait."}
                      {lockInfo.expiresAt && (
                        <span className="block mt-1 text-xs">
                          Lock expires:{" "}
                          {new Date(lockInfo.expiresAt).toLocaleString()}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-6"
                  >
                    {/* Slug Field Only (Status removed - managed via workflow) */}
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        {...form.register("slug")}
                        placeholder="url-friendly-slug"
                        disabled={isLocked}
                      />
                      <p className="text-xs text-muted-foreground">
                        Used in URLs. Leave empty to auto-generate.
                      </p>
                    </div>

                    {/* Dynamic Fields */}
                    <div className="space-y-6">
                      {contentType.schema.fields.map((field) => (
                        <FieldRenderer
                          key={field.name}
                          field={field}
                          value={entry?.data[field.name]}
                        />
                      ))}
                    </div>
                  </form>
                </Form>
              </div>
            </div>

            {/* Sidebar */}
            {isEditMode && entryId && (
              <EntrySidebar
                entry={entry}
                contentType={contentType}
                workflowStatus={workflowStatus}
                isLocked={isLocked}
                lockInfo={lockInfo}
                publishReadiness={publishReadinessQuery.data}
                revisions={revisions}
                autosaveEvents={autosaveEvents}
                onPreviewSnapshot={(revisionId, snapshotId) => {
                  // TODO: Implement preview snapshot
                  console.log("Preview snapshot", { revisionId, snapshotId });
                }}
                onRestoreRevision={(revisionId) => {
                  setRevisionToRestore(revisionId);
                  setRestoreDialogOpen(true);
                }}
                onTakeOverLock={() => {
                  acquireLockMutation.mutate();
                }}
                onFieldClick={(fieldName) => {
                  // Scroll to field
                  const fieldElement = document.querySelector(
                    `[name="${fieldName}"]`,
                  );
                  if (fieldElement) {
                    fieldElement.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }}
              />
            )}
          </div>
        </QueryState>
      </NotionStyleEditor>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Revision Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {CMS_ACTION_LABELS.restoreRevision}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this revision? This will replace
              the current entry data with the revision data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreRevision}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending
                ? "Restoring..."
                : CMS_ACTION_LABELS.restoreRevision}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Skeleton loader for entry editor
 */
function EntryEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton loader, index is stable and items don't change
        <div key={`skeleton-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
