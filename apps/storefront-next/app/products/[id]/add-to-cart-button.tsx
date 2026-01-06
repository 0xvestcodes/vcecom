"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";

interface AddToCartButtonProps {
  productId: string;
  disabled?: boolean;
  variantId?: string;
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={disabled || pending}>
      {pending ? "Adding..." : "Add to Cart"}
    </Button>
  );
}

export function AddToCartButton({
  productId,
  disabled,
  variantId,
}: AddToCartButtonProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addToCart, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Product added to cart");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value="1" />
      {variantId && <input type="hidden" name="variantId" value={variantId} />}
      <SubmitButton disabled={disabled} />
    </form>
  );
}
