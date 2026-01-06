"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { subscribeNewsletter } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
    >
      {pending ? "Subscribing..." : "Subscribe"}
    </Button>
  );
}

export function NewsletterForm() {
  const [state, formAction] = useActionState(
    async (
      _prevState: { error?: string; success?: boolean } | undefined,
      formData: FormData,
    ) => {
      return subscribeNewsletter(formData);
    },
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Successfully subscribed to newsletter!");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <Input
        type="email"
        name="email"
        placeholder="Enter your email"
        required
        className="w-full px-3 py-2 border rounded-md text-sm"
      />
      <SubmitButton />
    </form>
  );
}
