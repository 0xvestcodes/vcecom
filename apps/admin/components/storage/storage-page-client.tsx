"use client";

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorDisplay } from "@/components/ui/error-display";
import { useAdminStorageDelete } from "@/hooks/storage/use-admin-storage-delete";
import { useAdminStorageList } from "@/hooks/storage/use-admin-storage-list";
import type { FetchError } from "@/lib/api";
import {
  STORAGE_DEBOUNCE_DELAY_MS,
  STORAGE_DELETE_DIALOG_DESCRIPTION,
  STORAGE_DELETE_DIALOG_TITLE,
  STORAGE_EMPTY_STATE_DESCRIPTION,
  STORAGE_EMPTY_STATE_TITLE,
} from "@/lib/constants/storage.constants";
import { endpoints } from "@/lib/endpoints";
import type { FileMetadata } from "@/lib/types/storage";
import { StorageFilesTable } from "./storage-files-table";
import { StoragePreviewDialog } from "./storage-preview-dialog";
import { StorageUploadSection } from "./storage-upload-section";

export function StoragePageClient() {
  const [prefix, setPrefix] = useState("");
  const [debouncedPrefix, setDebouncedPrefix] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToPreview, setFileToPreview] = useState<FileMetadata | null>(null);

  const { data, isLoading, error, refetch } = useAdminStorageList({
    prefix: debouncedPrefix || undefined,
  });
  const deleteFile = useAdminStorageDelete();

  // Debounce prefix input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrefix(prefix);
    }, STORAGE_DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [prefix]);

  const handleDeleteClick = (key: string) => {
    setFileToDelete(key);
    setDeleteDialogOpen(true);
  };

  const handlePreviewClick = (file: FileMetadata) => {
    setFileToPreview(file);
    setPreviewDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      try {
        await deleteFile.mutateAsync(fileToDelete);
        refetch();
        setDeleteDialogOpen(false);
        setFileToDelete(null);
      } catch (_error) {
        // Error already handled by hook
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (prefix) formData.append("prefix", prefix);

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_URL}${endpoints.storage.upload}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        toast.success("File uploaded successfully");
        refetch();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || "Failed to upload file");
      }
    } catch (_error) {
      toast.error("Error uploading file. Please try again.");
    }
  };

  return (
    <AdminPageLayout title="Storage" description="Manage uploaded files">
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={STORAGE_DELETE_DIALOG_TITLE}
        description={STORAGE_DELETE_DIALOG_DESCRIPTION}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteFile.isPending}
      />

      <StoragePreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        file={fileToPreview}
      />

      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={() => refetch()}
          className="mb-4"
        />
      )}

      <div className="space-y-4">
        <StorageUploadSection
          prefix={prefix}
          onPrefixChange={setPrefix}
          onUpload={handleUpload}
          fileCount={data?.total}
        />

        {isLoading ? (
          <StorageFilesTable
            files={[]}
            onPreview={handlePreviewClick}
            onDelete={handleDeleteClick}
            isLoading={true}
          />
        ) : data && data.files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">
              {debouncedPrefix
                ? "No files found with this prefix"
                : STORAGE_EMPTY_STATE_TITLE}
            </p>
            <p className="text-xs mb-4">
              {debouncedPrefix
                ? "Try a different prefix or upload a new file"
                : STORAGE_EMPTY_STATE_DESCRIPTION}
            </p>
            {debouncedPrefix && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => setPrefix("")}
              >
                Clear filter
              </Button>
            )}
          </div>
        ) : (
          <StorageFilesTable
            files={data?.files || []}
            onPreview={handlePreviewClick}
            onDelete={handleDeleteClick}
            isLoading={false}
          />
        )}
      </div>
    </AdminPageLayout>
  );
}
