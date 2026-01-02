"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Order } from "@/lib/types/orders";
import { AddOrderNoteSheet } from "./add-order-note-sheet";
import { UpdateOrderAddressSheet } from "./update-order-address-sheet";

interface OrderActionsSheetProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Order Actions Sheet Component
 *
 * Move actions to Sheet (Add Note, Update Address, etc.)
 * Opens from order detail page
 * No full page redirects
 */
export function OrderActionsSheet({
  order,
  open,
  onOpenChange,
}: OrderActionsSheetProps) {
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Order Actions</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setNoteSheetOpen(true);
                onOpenChange(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setAddressSheetOpen(true);
                onOpenChange(false);
              }}
            >
              Update Address
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AddOrderNoteSheet
        orderId={order.id}
        open={noteSheetOpen}
        onOpenChange={setNoteSheetOpen}
      />

      <UpdateOrderAddressSheet
        orderId={order.id}
        open={addressSheetOpen}
        onOpenChange={setAddressSheetOpen}
      />
    </>
  );
}
