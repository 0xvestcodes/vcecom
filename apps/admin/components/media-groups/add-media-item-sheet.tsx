"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminCreateMediaItem } from "@/hooks/media-groups/use-admin-create-media-item";
import { useAdminStorageList } from "@/hooks/storage/use-admin-storage-list";
import type { CreateMediaItemInput } from "@/lib/types/media-groups";
import { AddMediaItemForm } from "./add-media-item-form";

interface AddMediaItemSheetProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMediaItemSheet({
  groupId,
  open,
  onOpenChange,
}: AddMediaItemSheetProps) {
  const [selectedFile, setSelectedFile] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const createItem = useAdminCreateMediaItem(groupId);
  const { data: storageFiles } = useAdminStorageList({
    prefix: "media",
  });

  const handleSubmit = async (
    data: Omit<CreateMediaItemInput, "groupId" | "storageKey" | "url">,
  ) => {
    if (!selectedFile) {
      return;
    }

    try {
      await createItem.mutateAsync({
        groupId,
        storageKey: selectedFile.key,
        url: selectedFile.url,
        ...data,
      });
      onOpenChange(false);
      setSelectedFile(null);
    } catch (_error) {
      // Error handled by hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Add Image to Group</SheetTitle>
          <SheetDescription>
            Select an image from storage and add it to this media group
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <AddMediaItemForm
              storageFiles={storageFiles?.files || []}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              onSubmit={handleSubmit}
              onCancel={() => {
                onOpenChange(false);
                setSelectedFile(null);
              }}
              isLoading={createItem.isPending}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
