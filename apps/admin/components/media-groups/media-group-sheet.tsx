"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminCreateMediaGroup } from "@/hooks/media-groups/use-admin-create-media-group";
import { useAdminMediaGroup } from "@/hooks/media-groups/use-admin-media-group";
import { useAdminUpdateMediaGroup } from "@/hooks/media-groups/use-admin-update-media-group";
import type {
  CreateMediaGroupInput,
  UpdateMediaGroupInput,
} from "@/lib/types/media-groups";
import { MediaGroupForm } from "./media-group-form";

interface MediaGroupSheetProps {
  mediaGroupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export function MediaGroupSheet({
  mediaGroupId,
  open,
  onOpenChange,
  onClose,
}: MediaGroupSheetProps) {
  const router = useRouter();
  const isEditMode = !!mediaGroupId;
  const { data: mediaGroup } = useAdminMediaGroup(mediaGroupId || "");
  const createMediaGroup = useAdminCreateMediaGroup();
  const updateMediaGroup = useAdminUpdateMediaGroup(mediaGroupId || "");

  const handleSubmit = async (
    data: CreateMediaGroupInput | UpdateMediaGroupInput,
  ) => {
    try {
      if (isEditMode) {
        await updateMediaGroup.mutateAsync(data as UpdateMediaGroupInput);
        onOpenChange(false);
        onClose?.();
      } else {
        const created = await createMediaGroup.mutateAsync(
          data as CreateMediaGroupInput,
        );
        onOpenChange(false);
        onClose?.();
        router.push(`/media-groups/${created.id}`);
      }
    } catch (_error) {
      // Error handled by hooks
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Media Group" : "Create Media Group"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <MediaGroupForm
              mediaGroup={mediaGroup}
              onSubmit={handleSubmit}
              onCancel={() => {
                onOpenChange(false);
                onClose?.();
              }}
              isLoading={
                isEditMode
                  ? updateMediaGroup.isPending
                  : createMediaGroup.isPending
              }
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
