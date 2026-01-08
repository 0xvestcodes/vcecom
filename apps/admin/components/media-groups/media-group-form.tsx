"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateMediaGroupInput,
  MediaGroup,
  UpdateMediaGroupInput,
} from "@/lib/types/media-groups";

const createMediaGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  slug: z.string().max(255, "Slug is too long").optional(),
  description: z.string().max(5000, "Description is too long").optional(),
  displayOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateMediaGroupSchema = createMediaGroupSchema.partial();

interface MediaGroupFormProps {
  mediaGroup?: MediaGroup;
  onSubmit: (
    data: CreateMediaGroupInput | UpdateMediaGroupInput,
  ) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function MediaGroupForm({
  mediaGroup,
  onSubmit,
  onCancel,
  isLoading = false,
}: MediaGroupFormProps) {
  const schema = mediaGroup ? updateMediaGroupSchema : createMediaGroupSchema;
  const form = useForm<CreateMediaGroupInput | UpdateMediaGroupInput>({
    resolver: zodResolver(schema) as any,
    defaultValues: mediaGroup
      ? {
          name: mediaGroup.name,
          slug: mediaGroup.slug,
          description: mediaGroup.description || undefined,
          displayOrder: mediaGroup.displayOrder,
          isActive: mediaGroup.isActive,
          metadata: mediaGroup.metadata || undefined,
        }
      : {
          name: "",
          slug: "",
          description: "",
          displayOrder: 0,
          isActive: true,
          metadata: undefined,
        },
  });

  const handleSubmit = async (
    data: CreateMediaGroupInput | UpdateMediaGroupInput,
  ) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., banners, hero-images" {...field} />
              </FormControl>
              <FormDescription>
                A descriptive name for this media group
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Auto-generated from name if not provided"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                URL-friendly identifier. Leave empty to auto-generate from name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this media group is for..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional description for this media group
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="displayOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Order</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value, 10) || 0)
                  }
                />
              </FormControl>
              <FormDescription>
                Lower numbers appear first when listing groups
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>
                  Inactive groups won't appear on the storefront
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Saving..."
              : mediaGroup
                ? "Update Media Group"
                : "Create Media Group"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
