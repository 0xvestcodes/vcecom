"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAdminUpdateMediaItem } from "@/hooks/media-groups/use-admin-update-media-item";
import type { MediaItem, UpdateMediaItemInput } from "@/lib/types/media-groups";

const updateMediaItemSchema = z.object({
  altText: z.string().max(500, "Alt text is too long").optional(),
  caption: z.string().max(1000, "Caption is too long").optional(),
  displayOrder: z.number().int().min(0).optional(),
  linkUrl: z
    .string()
    .url("Invalid URL")
    .max(500, "URL is too long")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
});

interface EditMediaItemDialogProps {
  item: MediaItem | null;
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export function EditMediaItemDialog({
  item,
  groupId,
  open,
  onOpenChange,
  onClose,
}: EditMediaItemDialogProps) {
  const updateItem = useAdminUpdateMediaItem(item?.id || "", groupId);

  const form = useForm<UpdateMediaItemInput>({
    resolver: zodResolver(updateMediaItemSchema),
    defaultValues: item
      ? {
          altText: item.altText || undefined,
          caption: item.caption || undefined,
          displayOrder: item.displayOrder,
          linkUrl: item.linkUrl || undefined,
          isActive: item.isActive,
        }
      : undefined,
  });

  // Reset form when item changes
  if (item && form.formState.defaultValues !== item) {
    form.reset({
      altText: item.altText || undefined,
      caption: item.caption || undefined,
      displayOrder: item.displayOrder,
      linkUrl: item.linkUrl || undefined,
      isActive: item.isActive,
    });
  }

  const handleSubmit = async (data: UpdateMediaItemInput) => {
    if (!item) return;

    try {
      await updateItem.mutateAsync(data);
      onOpenChange(false);
      onClose?.();
    } catch (_error) {
      // Error handled by hook
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>
            Update image details and settings
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="altText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alt Text</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descriptive alt text for accessibility"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional alt text for screen readers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caption</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Image caption" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional caption to display with the image
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="linkUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="/collections/summer-sale" {...field} />
                  </FormControl>
                  <FormDescription>
                    URL to navigate to when image is clicked
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
                  <FormDescription>Lower numbers appear first</FormDescription>
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
                      Inactive images won't appear on the storefront
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onClose?.();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateItem.isPending}>
                {updateItem.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
