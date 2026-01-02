"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useDeletePaymentCharge,
  usePaymentCharges,
} from "@/hooks/payment-charges/use-payment-charges";
import type { PaymentMethodChargeConfig } from "@/lib/types/payment-charges";
import { EmptyPaymentFeesState } from "./empty-payment-fees-state";
import { PaymentFeeSheet } from "./payment-fee-sheet";

/**
 * Refactored Payment Fees using ListLayout pattern (L1)
 * Payment fees are managed as a list with create/edit via Sheet
 */
export function PaymentFeesRefactored() {
  const { data: charges, isLoading, error } = usePaymentCharges();
  const [paymentFeeSheetOpen, setPaymentFeeSheetOpen] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<string | null>(null);

  const deleteCharge = useDeletePaymentCharge();

  const handleCreate = () => {
    setSelectedChargeId(null);
    setPaymentFeeSheetOpen(true);
  };

  const handleEdit = (chargeId: string) => {
    setSelectedChargeId(chargeId);
    setPaymentFeeSheetOpen(true);
  };

  const handleDeleteClick = (chargeId: string) => {
    setChargeToDelete(chargeId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (chargeToDelete) {
      try {
        await deleteCharge.mutateAsync(chargeToDelete);
        toast.success("Payment fee deleted successfully");
        setDeleteDialogOpen(false);
        setChargeToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  // Convert charges to table format
  const columns: Column<PaymentMethodChargeConfig>[] = [
    {
      id: "method",
      header: "Payment Method",
      cell: (charge: PaymentMethodChargeConfig) => {
        const METHOD_LABELS: Record<string, string> = {
          COD: "Cash on Delivery",
          RAZORPAY_UPI: "UPI (Razorpay)",
          RAZORPAY_CARD: "Card (Razorpay)",
          STRIPE_CARD: "Card (Stripe)",
          WALLET: "Wallet",
          NETBANKING: "Net Banking",
          BNPL: "Buy Now Pay Later",
        };
        return (
          <span className="font-medium">
            {METHOD_LABELS[charge.method] || charge.method || "N/A"}
          </span>
        );
      },
    },
    {
      id: "chargeType",
      header: "Charge Type",
      cell: (charge: PaymentMethodChargeConfig) => (
        <span className="text-sm">{charge.chargeType || "-"}</span>
      ),
    },
    {
      id: "fee",
      header: "Fee",
      cell: (charge: PaymentMethodChargeConfig) => {
        const formatAmount = (rupees: number) => `₹${rupees.toFixed(2)}`;
        if (charge.chargeType === "FLAT") {
          return (
            <span className="text-sm">{formatAmount(charge.flatAmount)}</span>
          );
        }
        if (charge.chargeType === "PERCENTAGE") {
          return <span className="text-sm">{charge.percentage}%</span>;
        }
        if (charge.chargeType === "MIXED") {
          return (
            <span className="text-sm">
              {charge.percentage}% + {formatAmount(charge.flatAmount)}
            </span>
          );
        }
        return <span className="text-sm">-</span>;
      },
    },
    {
      id: "active",
      header: "Status",
      cell: (charge: PaymentMethodChargeConfig) => (
        <span className="text-xs">{charge.active ? "Active" : "Inactive"}</span>
      ),
    },
  ];

  const rowActions: RowAction<PaymentMethodChargeConfig>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (charge: PaymentMethodChargeConfig) => handleEdit(charge.id),
      roles: ["admin"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (charge: PaymentMethodChargeConfig) =>
        handleDeleteClick(charge.id),
      destructive: true,
      roles: ["admin"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Payment Fees"
        description="Configure charges for different payment methods"
        createButton={
          <ProtectedButton requiredRoles={["admin"]}>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment Fee
            </Button>
          </ProtectedButton>
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={charges}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyPaymentFeesState onCreate={handleCreate} />}
          onRetry={() => window.location.reload()}
        >
          {charges && (
            <DataTable<PaymentMethodChargeConfig>
              columns={columns}
              data={charges}
              rowActions={rowActions}
              emptyMessage="No payment fees found"
              isLoading={isLoading}
            />
          )}
        </QueryState>
      </ListLayout>

      <PaymentFeeSheet
        chargeId={selectedChargeId}
        open={paymentFeeSheetOpen}
        onOpenChange={(open) => {
          setPaymentFeeSheetOpen(open);
          if (!open) {
            setSelectedChargeId(null);
          }
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Payment Fee"
        description="Are you sure you want to delete this payment fee? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteCharge.isPending}
      />
    </>
  );
}
