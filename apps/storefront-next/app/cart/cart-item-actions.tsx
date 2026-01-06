"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { removeCartItem, updateCartItem } from "@/app/actions/cart";
import { Button } from "@/components/ui/button";

interface CartItemActionsProps {
  itemId: string;
  quantity: number;
}

export function CartItemActions({ itemId, quantity }: CartItemActionsProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleUpdate(newQuantity: number) {
    if (newQuantity < 1) return;

    setIsUpdating(true);
    const result = await updateCartItem(itemId, newQuantity);
    setIsUpdating(false);

    if (result.success) {
      toast.success("Cart updated");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update cart");
    }
  }

  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this item from your cart?")) {
      return;
    }

    setIsRemoving(true);
    const result = await removeCartItem(itemId);
    setIsRemoving(false);

    if (result.success) {
      toast.success("Item removed from cart");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to remove item");
    }
  }

  return (
    <div className="flex items-center gap-2 mt-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => handleUpdate(quantity - 1)}
        disabled={isUpdating || isRemoving || quantity <= 1}
      >
        -
      </Button>
      <span className="w-12 text-center">{quantity}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => handleUpdate(quantity + 1)}
        disabled={isUpdating || isRemoving}
      >
        +
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleRemove}
        disabled={isUpdating || isRemoving}
        className="ml-auto"
      >
        {isRemoving ? "Removing..." : "Remove"}
      </Button>
    </div>
  );
}
