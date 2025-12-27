"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorDisplay } from "@/components/ui/error-display";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAdminCreateBundle } from "@/hooks/bundles/use-admin-create-bundle";
import type { FetchError } from "@/lib/api";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type {
  CreateBundleInput,
  CreateBundleSetInput,
} from "@/lib/types/bundles";

interface BundleWithSetsFormData extends CreateBundleInput {
  sets: CreateBundleSetInput[];
}

export default function CreateBundlePage() {
  const router = useRouter();
  const createBundle = useAdminCreateBundle();
  const [apiError, setApiError] = useState<FetchError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
    setError,
  } = useForm<BundleWithSetsFormData>({
    defaultValues: {
      title: "",
      description: "",
      isActive: true,
      allowMixAndMatch: false,
      sets: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sets",
  });

  const isActive = watch("isActive");
  const allowMixAndMatch = watch("allowMixAndMatch");
  const sets = watch("sets");

  const onSubmit = async (data: BundleWithSetsFormData) => {
    setApiError(null);
    setIsSubmitting(true);

    try {
      // Create bundle first
      const bundle = await createBundle.mutateAsync({
        title: data.title,
        description: data.description || null,
        isActive: data.isActive,
        allowMixAndMatch: data.allowMixAndMatch,
      });

      // Create all sets sequentially
      if (data.sets && data.sets.length > 0) {
        for (const setData of data.sets) {
          try {
            await api.post<{ id: string; message: string }>(
              endpoints.bundles.sets.create(bundle.id),
              setData,
            );
          } catch (setError) {
            console.error("Failed to create set:", setError);
            // Continue with other sets even if one fails
          }
        }
      }

      // Redirect to bundle detail page
      router.push(`/bundles/${bundle.id}`);
    } catch (error) {
      if (error instanceof Error && "errors" in error) {
        const fetchError = error as FetchError;
        setApiError(fetchError);

        if (fetchError.errors) {
          Object.entries(fetchError.errors).forEach(([field, messages]) => {
            setError(field as keyof BundleWithSetsFormData, {
              type: "server",
              message: Array.isArray(messages) ? messages.join(", ") : messages,
            });
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSet = () => {
    append({
      title: "",
      description: "",
      minQuantity: 1,
      maxQuantity: 1,
    });
  };

  return (
    <AdminPageLayout
      title="Create Bundle"
      description="Create a new product bundle with choice sets"
      breadcrumbs={[
        { label: "Bundles", href: "/bundles" },
        { label: "Create" },
      ]}
    >
      {apiError && (
        <ErrorDisplay error={apiError} onRetry={() => setApiError(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Basic Information</CardTitle>
            <CardDescription className="text-xs">
              Provide basic details about your bundle
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                {...register("title", { required: "Title is required" })}
                placeholder="Summer Bundle"
                aria-invalid={errors.title ? "true" : "false"}
              />
              <FieldError error={errors.title?.message} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Optional description for your bundle"
                aria-invalid={errors.description ? "true" : "false"}
              />
              <FieldError error={errors.description?.message} />
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Settings</CardTitle>
            <CardDescription className="text-xs">
              Configure bundle behavior and options
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-xs">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only active bundles are visible to customers
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => {
                  setValue("isActive", checked);
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="allowMixAndMatch" className="text-xs">
                  Allow Mix and Match
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to mix variants from the same product across
                  different sets
                </p>
              </div>
              <Switch
                id="allowMixAndMatch"
                checked={allowMixAndMatch}
                onCheckedChange={(checked) => {
                  setValue("allowMixAndMatch", checked);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Choice Sets */}
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Choice Sets</CardTitle>
                <CardDescription className="text-xs">
                  Create sets that customers can choose from. Each set can have
                  multiple product variants.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSet}
                className="text-xs"
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add Set
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {fields.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-border/50 bg-card/30">
                <p className="text-xs text-muted-foreground mb-4">
                  No choice sets added yet. Click "Add Set" to create your first
                  set.
                </p>
              </div>
            ) : (
              fields.map((field, index) => {
                const setErrors = errors.sets?.[index];
                const setData = sets[index];

                return (
                  <Card
                    key={field.id}
                    className="rounded-lg border border-border/50 bg-card/30"
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs">
                          Set {index + 1}
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`sets.${index}.title`}>
                          Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`sets.${index}.title`}
                          {...register(`sets.${index}.title`, {
                            required: "Set title is required",
                          })}
                          placeholder="Choose your T-shirt"
                          aria-invalid={setErrors?.title ? "true" : "false"}
                        />
                        <FieldError error={setErrors?.title?.message} />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`sets.${index}.description`}>
                          Description
                        </Label>
                        <Textarea
                          id={`sets.${index}.description`}
                          {...register(`sets.${index}.description`)}
                          placeholder="Optional description"
                          rows={2}
                          aria-invalid={
                            setErrors?.description ? "true" : "false"
                          }
                        />
                        <FieldError error={setErrors?.description?.message} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`sets.${index}.minQuantity`}>
                            Min Quantity{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`sets.${index}.minQuantity`}
                            type="number"
                            min="0"
                            max="15"
                            {...register(`sets.${index}.minQuantity`, {
                              required: "Min quantity is required",
                              valueAsNumber: true,
                              min: { value: 0, message: "Must be at least 0" },
                              max: { value: 15, message: "Must be at most 15" },
                            })}
                            aria-invalid={
                              setErrors?.minQuantity ? "true" : "false"
                            }
                          />
                          <FieldError error={setErrors?.minQuantity?.message} />
                          <p className="text-xs text-muted-foreground">
                            Minimum items (0-15)
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`sets.${index}.maxQuantity`}>
                            Max Quantity{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`sets.${index}.maxQuantity`}
                            type="number"
                            min="1"
                            max="15"
                            {...register(`sets.${index}.maxQuantity`, {
                              required: "Max quantity is required",
                              valueAsNumber: true,
                              min: { value: 1, message: "Must be at least 1" },
                              max: { value: 15, message: "Must be at most 15" },
                              validate: (value) => {
                                const min = setData?.minQuantity ?? 0;
                                if (value < min) {
                                  return "Must be >= min quantity";
                                }
                                return true;
                              },
                            })}
                            aria-invalid={
                              setErrors?.maxQuantity ? "true" : "false"
                            }
                          />
                          <FieldError error={setErrors?.maxQuantity?.message} />
                          <p className="text-xs text-muted-foreground">
                            Maximum items (1-15)
                          </p>
                        </div>
                      </div>

                      {setData && setData.minQuantity > setData.maxQuantity && (
                        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                          Min quantity must be less than or equal to max
                          quantity
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/bundles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
          <LoadingButton
            type="submit"
            isLoading={isSubmitting || createBundle.isPending}
            loadingText="Creating..."
          >
            Create Bundle
          </LoadingButton>
        </div>
      </form>
    </AdminPageLayout>
  );
}
