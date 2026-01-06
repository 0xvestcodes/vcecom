"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddToBlacklist } from "@/hooks/fraud-detection/use-fraud-blacklists";
import { BlacklistType } from "@/lib/types/fraud-detection";

const addToBlacklistSchema = z.object({
  type: z.enum(["email", "phone", "address"]),
  value: z.string().min(1, "Value is required"),
  reason: z.string().optional(),
});

type AddToBlacklistForm = z.infer<typeof addToBlacklistSchema>;

interface AddToBlacklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddToBlacklistDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddToBlacklistDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addToBlacklistMutation = useAddToBlacklist();

  const form = useForm<AddToBlacklistForm>({
    resolver: zodResolver(addToBlacklistSchema),
    defaultValues: {
      type: "email",
      value: "",
      reason: "",
    },
  });

  const onSubmit = async (data: AddToBlacklistForm) => {
    setIsSubmitting(true);
    try {
      // Map string literal to enum
      const enumType =
        data.type === "email"
          ? BlacklistType.EMAIL
          : data.type === "phone"
            ? BlacklistType.PHONE
            : BlacklistType.ADDRESS;

      await addToBlacklistMutation.mutateAsync({
        type: enumType,
        value: data.value,
        reason: data.reason,
      });
      form.reset();
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Blacklist</DialogTitle>
          <DialogDescription>
            Add an email, phone number, or address to the fraud blacklist.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="address">Address</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        form.watch("type") === "email"
                          ? "fraud@example.com"
                          : form.watch("type") === "phone"
                            ? "+91XXXXXXXXXX"
                            : "Street, City, State, PIN"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reason for blacklisting..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add to Blacklist"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
