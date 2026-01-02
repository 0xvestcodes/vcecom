"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminDeletePriceList } from "@/hooks/pricing/use-admin-delete-price-list";
import { useAdminPriceList } from "@/hooks/pricing/use-admin-price-list";
import { useAdminUpdatePriceList } from "@/hooks/pricing/use-admin-update-price-list";
import type { UpdatePriceListInput } from "@/lib/types/price-lists";
import { DateTime } from "../orders/date-time";
import { AddPriceListItemSheet } from "./add-price-list-item-sheet";
import { PriceListItemTable } from "./price-list-item-table";

interface PriceListEditorPanelProps {
  priceListId: string;
}

/**
 * Refactored Price List Editor Panel using EditorPanel layout (L2 pattern)
 * Uses collapsible sections instead of tabs
 */
export function PriceListEditorPanel({
  priceListId,
}: PriceListEditorPanelProps) {
  const router = useRouter();
  const { data: priceList, isLoading } = useAdminPriceList(priceListId);
  const updatePriceList = useAdminUpdatePriceList(priceListId);
  const deletePriceList = useAdminDeletePriceList(priceListId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePriceListInput>();

  useEffect(() => {
    if (priceList) {
      reset({
        name: priceList.name,
        description: priceList.description ?? undefined,
        isActive: priceList.isActive,
      });
    }
  }, [priceList, reset]);

  const handleSave = async (data: UpdatePriceListInput) => {
    try {
      await updatePriceList.mutateAsync(data);
      toast.success("Price list updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update price list",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deletePriceList.mutateAsync();
      toast.success("Price list deleted successfully");
      router.push("/price-lists");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete price list",
      );
    }
  };

  if (isLoading) {
    return (
      <EditorPanel title="Loading..." backHref="/price-lists">
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </EditorPanel>
    );
  }

  if (!priceList) {
    return (
      <EditorPanel title="Price List Not Found" backHref="/price-lists">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Price list not found</p>
        </div>
      </EditorPanel>
    );
  }

  const statusVariant = priceList.isActive ? "default" : "secondary";

  return (
    <>
      <form onSubmit={handleSubmit(handleSave)}>
        <EditorPanel
          title={priceList.name}
          breadcrumbs={[
            { label: "Price Lists", href: "/price-lists" },
            { label: priceList.name },
          ]}
          status={{
            label: priceList.isActive ? "Active" : "Inactive",
            variant: statusVariant,
          }}
          onSave={handleSubmit(handleSave)}
          isSaving={updatePriceList.isPending}
          backHref="/price-lists"
          sidebar={
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium">{priceList.type}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Priority</div>
                  <div className="font-medium">{priceList.priority}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Items</div>
                  <div className="font-medium">
                    {priceList.items?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <DateTime date={priceList.createdAt} />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <DateTime date={priceList.updatedAt} />
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
              Delete Price List
            </Button>
          }
        >
          {/* General Info Section */}
          <CollapsibleSection title="General Information" defaultOpen>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  aria-invalid={errors.name ? "true" : "false"}
                />
                <FieldError error={errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  rows={3}
                  aria-invalid={errors.description ? "true" : "false"}
                />
                <FieldError error={errors.description?.message} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Price Overrides Section */}
          <CollapsibleSection title="Price Overrides" defaultOpen={false}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Manage price overrides for products, variants, and categories
                </p>
                <Button
                  type="button"
                  onClick={() => setAddItemSheetOpen(true)}
                  size="sm"
                >
                  Add Override
                </Button>
              </div>
              <PriceListItemTable
                priceListId={priceListId}
                items={priceList.items || []}
              />
            </div>
          </CollapsibleSection>
        </EditorPanel>
      </form>

      <AddPriceListItemSheet
        priceListId={priceListId}
        open={addItemSheetOpen}
        onOpenChange={setAddItemSheetOpen}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Price List"
        description="Are you sure you want to delete this price list? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deletePriceList.isPending}
      />
    </>
  );
}
