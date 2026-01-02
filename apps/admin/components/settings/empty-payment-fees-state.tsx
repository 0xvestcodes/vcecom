"use client";

import { CreditCard, Plus } from "lucide-react";
import { ProtectedButton } from "@/components/common/protected-button";
import { Button } from "@/components/ui/button";

interface EmptyPaymentFeesStateProps {
  onCreate?: () => void;
}

export function EmptyPaymentFeesState({
  onCreate,
}: EmptyPaymentFeesStateProps) {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No payment fees found</p>
      <p className="text-xs mb-4">
        Configure charges for different payment methods
      </p>
      {onCreate && (
        <ProtectedButton requiredRoles={["admin"]}>
          <Button onClick={onCreate} size="sm">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Payment Fee
          </Button>
        </ProtectedButton>
      )}
    </div>
  );
}
