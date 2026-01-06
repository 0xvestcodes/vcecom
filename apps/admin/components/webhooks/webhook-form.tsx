"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useCreateWebhook,
  useUpdateWebhook,
  useWebhook,
} from "@/hooks/webhooks/use-webhooks";

const webhookFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "At least one event must be selected"),
  secret: z.string().min(8, "Secret must be at least 8 characters"),
  isActive: z.boolean(),
  timeoutMs: z.number().min(1000).max(300000),
});

type WebhookFormValues = z.infer<typeof webhookFormSchema>;

const AVAILABLE_EVENTS = [
  // Order events
  "order.created",
  "order.confirmed",
  "order.processing",
  "order.shipped",
  "order.delivered",
  "order.cancelled",
  "order.payment.completed",
  "order.payment.failed",
  "order.refund.initiated",
  "order.refund.completed",
  // Product events
  "product.created",
  "product.updated",
  "product.deleted",
  "product.published",
  "product.unpublished",
  // Customer events
  "customer.created",
  "customer.updated",
  "customer.deleted",
];

interface WebhookFormProps {
  webhookId?: string;
  onSuccess?: () => void;
}

export function WebhookForm({ webhookId, onSuccess }: WebhookFormProps) {
  const router = useRouter();
  const { data: existingWebhook } = useWebhook(webhookId || "");
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      name: "",
      url: "",
      events: [],
      secret: "",
      isActive: true,
      timeoutMs: 30000,
    },
  });

  useEffect(() => {
    if (existingWebhook) {
      form.reset({
        name: existingWebhook.name,
        url: existingWebhook.url,
        events: existingWebhook.events,
        secret: "", // Don't populate secret for security
        isActive: existingWebhook.isActive,
        timeoutMs: existingWebhook.timeoutMs,
      });
    }
  }, [existingWebhook, form]);

  const onSubmit = async (data: WebhookFormValues) => {
    try {
      if (webhookId) {
        await updateWebhook.mutateAsync({
          id: webhookId,
          data: {
            name: data.name,
            url: data.url,
            events: data.events,
            secret: data.secret || undefined, // Only update if provided
            isActive: data.isActive,
            timeoutMs: data.timeoutMs,
          },
        });
      } else {
        await createWebhook.mutateAsync({
          name: data.name,
          url: data.url,
          events: data.events,
          secret: data.secret,
          isActive: data.isActive,
          timeoutMs: data.timeoutMs,
        });
      }

      onSuccess?.();
      router.push("/settings/webhooks");
    } catch (error) {
      console.error("Failed to save webhook:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Webhook" {...field} />
              </FormControl>
              <FormDescription>
                A descriptive name for this webhook
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://example.com/webhook"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The URL where webhooks will be delivered
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="secret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secret</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter webhook secret"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Secret used for HMAC signature verification
                {webhookId && " (leave empty to keep current secret)"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="events"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Events</FormLabel>
                <FormDescription>
                  Select which events should trigger this webhook
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVAILABLE_EVENTS.map((event) => (
                  <FormField
                    key={event}
                    control={form.control}
                    name="events"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={event}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(event)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, event])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== event,
                                      ),
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">
                            {event}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timeoutMs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timeout (milliseconds)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1000}
                  max={300000}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormDescription>
                Request timeout in milliseconds (1000-300000)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Active</FormLabel>
                <FormDescription>
                  Enable or disable this webhook
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createWebhook.isPending || updateWebhook.isPending}
          >
            {createWebhook.isPending || updateWebhook.isPending
              ? "Saving..."
              : webhookId
                ? "Update Webhook"
                : "Create Webhook"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
