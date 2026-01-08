"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminDeleteMediaGroup } from "@/hooks/media-groups/use-admin-delete-media-group";
import { useAdminMediaGroup } from "@/hooks/media-groups/use-admin-media-group";
import { useAdminMediaGroupItems } from "@/hooks/media-groups/use-admin-media-group-items";
import { useAdminUpdateMediaGroup } from "@/hooks/media-groups/use-admin-update-media-group";
import type { UpdateMediaGroupInput } from "@/lib/types/media-groups";
import { DateTime } from "../orders/date-time";
import { AddMediaItemSheet } from "./add-media-item-sheet";
import { MediaGroupForm } from "./media-group-form";
import { MediaItemsTable } from "./media-items-table";

interface MediaGroupEditorPanelProps {
  mediaGroupId: string;
}

export function MediaGroupEditorPanel({
  mediaGroupId,
}: MediaGroupEditorPanelProps) {
  const router = useRouter();
  const { data: mediaGroup, isLoading } = useAdminMediaGroup(mediaGroupId);
  const { data: items, isLoading: isLoadingItems } =
    useAdminMediaGroupItems(mediaGroupId);
  const updateMediaGroup = useAdminUpdateMediaGroup(mediaGroupId);
  const deleteMediaGroup = useAdminDeleteMediaGroup();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false);

  const handleSave = async (data: UpdateMediaGroupInput) => {
    try {
      await updateMediaGroup.mutateAsync(data);
      toast.success("Media group updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update media group",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMediaGroup.mutateAsync(mediaGroupId);
      toast.success("Media group deleted successfully");
      router.push("/media-groups");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete media group",
      );
    }
  };

  if (isLoading) {
    return (
      <EditorPanel title="Loading..." backHref="/media-groups">
        <div className="space-y-4">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      </EditorPanel>
    );
  }

  if (!mediaGroup) {
    return (
      <EditorPanel title="Media Group Not Found" backHref="/media-groups">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Media group not found</p>
        </div>
      </EditorPanel>
    );
  }

  const statusVariant = mediaGroup.isActive ? "default" : "secondary";

  return (
    <>
      <EditorPanel
        title={mediaGroup.name}
        breadcrumbs={[
          { label: "Media Groups", href: "/media-groups" },
          { label: mediaGroup.name },
        ]}
        status={{
          label: mediaGroup.isActive ? "Active" : "Inactive",
          variant: statusVariant,
        }}
        onSave={undefined}
        isSaving={updateMediaGroup.isPending}
        backHref="/media-groups"
        sidebar={
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Slug</div>
                <div className="font-mono text-sm font-medium">
                  {mediaGroup.slug}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Images</div>
                <div className="font-medium">{mediaGroup.imageCount || 0}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Display Order
                </div>
                <div className="font-medium">{mediaGroup.displayOrder}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <DateTime date={mediaGroup.createdAt} />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Updated</div>
                <DateTime date={mediaGroup.updatedAt} />
              </div>
            </CardContent>
          </Card>
        }
        warningActions={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Media Group
          </Button>
        }
      >
        {/* General Information Section */}
        <CollapsibleSection title="General Information" defaultOpen>
          <MediaGroupForm
            mediaGroup={mediaGroup}
            onSubmit={handleSave}
            isLoading={updateMediaGroup.isPending}
          />
        </CollapsibleSection>

        {/* Images Section */}
        <CollapsibleSection title="Images" defaultOpen>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Manage images in this group. Upload images via Storage first,
                then add them here.
              </p>
              <Button onClick={() => setAddItemSheetOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Image
              </Button>
            </div>
            <MediaItemsTable
              items={items || []}
              groupId={mediaGroupId}
              isLoading={isLoadingItems}
            />
          </div>
        </CollapsibleSection>
      </EditorPanel>

      <AddMediaItemSheet
        groupId={mediaGroupId}
        open={addItemSheetOpen}
        onOpenChange={setAddItemSheetOpen}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Media Group"
        description="Are you sure you want to delete this media group? All images in this group will also be deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMediaGroup.isPending}
      />
    </>
  );
}
