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
import { useAdminBundle } from "@/hooks/bundles/use-admin-bundle";
import { useAdminDeleteBundle } from "@/hooks/bundles/use-admin-delete-bundle";
import { useAdminUpdateBundle } from "@/hooks/bundles/use-admin-update-bundle";
import type { UpdateBundleInput } from "@/lib/types/bundles";
import { DateTime } from "../orders/date-time";
import { BundleSetsManager } from "./bundle-sets-manager";

interface BundleEditorPanelProps {
  bundleId: string;
}

/**
 * Refactored Bundle Editor Panel using EditorPanel layout (L2 pattern)
 * Uses collapsible sections instead of tabs
 */
export function BundleEditorPanel({ bundleId }: BundleEditorPanelProps) {
  const router = useRouter();
  const { data: bundle, isLoading } = useAdminBundle(bundleId);
  const updateBundle = useAdminUpdateBundle(bundleId);
  const deleteBundle = useAdminDeleteBundle();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateBundleInput>();

  useEffect(() => {
    if (bundle) {
      reset({
        title: bundle.title,
        description: bundle.description || undefined,
        isActive: bundle.isActive,
        allowMixAndMatch: bundle.allowMixAndMatch,
      });
    }
  }, [bundle, reset]);

  const handleSave = async (data: UpdateBundleInput) => {
    try {
      await updateBundle.mutateAsync(data);
      toast.success("Bundle updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update bundle",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBundle.mutateAsync(bundleId);
      toast.success("Bundle deleted successfully");
      router.push("/bundles");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete bundle",
      );
    }
  };

  if (isLoading) {
    return (
      <EditorPanel title="Loading..." backHref="/bundles">
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </EditorPanel>
    );
  }

  if (!bundle) {
    return (
      <EditorPanel title="Bundle Not Found" backHref="/bundles">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bundle not found</p>
        </div>
      </EditorPanel>
    );
  }

  const statusVariant = bundle.isActive ? "default" : "secondary";

  return (
    <>
      <form onSubmit={handleSubmit(handleSave)}>
        <EditorPanel
          title={bundle.title}
          breadcrumbs={[
            { label: "Bundles", href: "/bundles" },
            { label: bundle.title },
          ]}
          status={{
            label: bundle.isActive ? "Active" : "Inactive",
            variant: statusVariant,
          }}
          onSave={handleSubmit(handleSave)}
          isSaving={updateBundle.isPending}
          backHref="/bundles"
          sidebar={
            <>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Sets</div>
                    <div className="font-medium">
                      {bundle.sets?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Mix & Match
                    </div>
                    <div className="font-medium">
                      {bundle.allowMixAndMatch ? "Yes" : "No"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Created</div>
                    <DateTime date={bundle.createdAt} />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Updated</div>
                    <DateTime date={bundle.updatedAt} />
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
              Delete Bundle
            </Button>
          }
        >
          {/* General Information Section */}
          <CollapsibleSection title="General Information" defaultOpen>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register("title", { required: "Title is required" })}
                  aria-invalid={errors.title ? "true" : "false"}
                />
                <FieldError error={errors.title?.message} />
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

          {/* Sets Section */}
          <CollapsibleSection title="Bundle Sets" defaultOpen={false}>
            <BundleSetsManager bundleId={bundleId} />
          </CollapsibleSection>
        </EditorPanel>
      </form>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Bundle"
        description="Are you sure you want to delete this bundle? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteBundle.isPending}
      />
    </>
  );
}
