"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePaymentCharge } from "@/hooks/payment-charges/use-payment-charges";
import { PaymentFeesForm } from "./payment-fees-form";

interface PaymentFeeSheetProps {
  chargeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Payment Fee Sheet Component (L3 pattern)
 *
 * Create/Edit payment fees via Sheet (not full page)
 * Opens from payment fees list
 */
export function PaymentFeeSheet({
  chargeId,
  open,
  onOpenChange,
}: PaymentFeeSheetProps) {
  const isEditMode = !!chargeId;
  const { data: charge } = usePaymentCharge(chargeId || "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Payment Fee" : "Create Payment Fee"}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 pr-6 -mr-6">
          <div className="py-4">
            <PaymentFeesForm
              chargeId={chargeId || undefined}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
