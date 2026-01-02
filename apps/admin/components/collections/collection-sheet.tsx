"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminCollection } from "@/hooks/collections/use-admin-collection";
import { useAdminCreateCollection } from "@/hooks/collections/use-admin-create-collection";
import { useAdminUpdateCollection } from "@/hooks/collections/use-admin-update-collection";
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from "@/lib/types/collections";
import { CollectionFormWizard } from "./collection-form-wizard";

interface CollectionSheetProps {
  collectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Collection Sheet Component (L3 pattern)
 *
 * Create/Edit collections via Sheet (not full page)
 * Opens from collections list
 */
export function CollectionSheet({
  collectionId,
  open,
  onOpenChange,
}: CollectionSheetProps) {
  const router = useRouter();
  const isEditMode = !!collectionId;
  const { data: collection } = useAdminCollection(collectionId || "");
  const createCollection = useAdminCreateCollection();
  const updateCollection = useAdminUpdateCollection(collectionId || "");

  const handleSubmit = async (
    data: CreateCollectionInput | UpdateCollectionInput,
  ) => {
    try {
      if (isEditMode) {
        await updateCollection.mutateAsync(data as UpdateCollectionInput);
        onOpenChange(false);
      } else {
        const created = await createCollection.mutateAsync(
          data as CreateCollectionInput,
        );
        onOpenChange(false);
        router.push(`/products/collections/${created.id}`);
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
            {isEditMode ? "Edit Collection" : "Create Collection"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <CollectionFormWizard
              initialData={collection}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              isLoading={
                isEditMode
                  ? updateCollection.isPending
                  : createCollection.isPending
              }
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
