"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminCollection } from "@/hooks/collections/use-admin-collection";
import { useAdminCollectionProducts } from "@/hooks/collections/use-admin-collection-products";
import { useAdminDeleteCollection } from "@/hooks/collections/use-admin-delete-collection";
import { useAdminUpdateCollection } from "@/hooks/collections/use-admin-update-collection";
import type { UpdateCollectionInput } from "@/lib/types/collections";
import { DateTime } from "../orders/date-time";
import { AddProductsSheet } from "./add-products-sheet";
import { CollectionFormWizard } from "./collection-form-wizard";
import { CollectionProductsTable } from "./collection-products-table";

interface CollectionEditorPanelProps {
  collectionId: string;
}

/**
 * Refactored Collection Editor Panel using EditorPanel layout (L2 pattern)
 * Uses collapsible sections instead of tabs
 */
export function CollectionEditorPanel({
  collectionId,
}: CollectionEditorPanelProps) {
  const router = useRouter();
  const { data: collection, isLoading } = useAdminCollection(collectionId);
  const { data: products, isLoading: isLoadingProducts } =
    useAdminCollectionProducts(collectionId);
  const updateCollection = useAdminUpdateCollection(collectionId);
  const deleteCollection = useAdminDeleteCollection();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addProductsSheetOpen, setAddProductsSheetOpen] = useState(false);

  const handleSave = async (data: UpdateCollectionInput) => {
    try {
      await updateCollection.mutateAsync(data);
      toast.success("Collection updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update collection",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCollection.mutateAsync(collectionId);
      toast.success("Collection deleted successfully");
      router.push("/products/collections");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete collection",
      );
    }
  };

  if (isLoading) {
    return (
      <EditorPanel title="Loading..." backHref="/products/collections">
        <div className="space-y-4">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      </EditorPanel>
    );
  }

  if (!collection) {
    return (
      <EditorPanel
        title="Collection Not Found"
        backHref="/products/collections"
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Collection not found</p>
        </div>
      </EditorPanel>
    );
  }

  const statusVariant = collection.isActive !== false ? "default" : "secondary";

  return (
    <>
      <EditorPanel
        title={
          <div className="flex items-center gap-2">
            {collection.name}
            {collection.type && (
              <Badge
                variant={
                  collection.type === "automatic" ? "default" : "secondary"
                }
              >
                {collection.type === "automatic" ? "Automatic" : "Manual"}
              </Badge>
            )}
          </div>
        }
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "Collections", href: "/products/collections" },
          { label: collection.name },
        ]}
        status={{
          label: collection.isActive !== false ? "Active" : "Inactive",
          variant: statusVariant,
        }}
        onSave={undefined}
        isSaving={updateCollection.isPending}
        backHref="/products/collections"
        sidebar={
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium">
                    {collection.type === "automatic" ? "Automatic" : "Manual"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Products</div>
                  <div className="font-medium">
                    {collection.productCount || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <DateTime date={collection.createdAt} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <DateTime date={collection.updatedAt} />
                </div>
              </CardContent>
            </Card>
          </>
        }
        warningActions={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Collection
          </Button>
        }
      >
        {/* General Information Section */}
        <CollapsibleSection title="General Information" defaultOpen>
          <CollectionFormWizard
            collection={collection}
            onSubmit={handleSave}
            isLoading={updateCollection.isPending}
          />
        </CollapsibleSection>

        {/* Products Section */}
        <CollapsibleSection title="Products" defaultOpen={false}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Manage products in this collection
              </p>
              <Button
                type="button"
                onClick={() => setAddProductsSheetOpen(true)}
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Products
              </Button>
            </div>
            {isLoadingProducts ? (
              <div className="text-sm text-muted-foreground">
                Loading products...
              </div>
            ) : products && products.length > 0 ? (
              <CollectionProductsTable
                products={products}
                collectionId={collectionId}
                onRemove={() => {}}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm mb-4">No products in this collection</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddProductsSheetOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Products
                </Button>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </EditorPanel>

      <AddProductsSheet
        collectionId={collectionId}
        open={addProductsSheetOpen}
        onOpenChange={setAddProductsSheetOpen}
        existingProductIds={products?.map((p) => p.id) || []}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Collection"
        description="Are you sure you want to delete this collection? Products will remain but will be removed from this collection."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteCollection.isPending}
      />
    </>
  );
}
