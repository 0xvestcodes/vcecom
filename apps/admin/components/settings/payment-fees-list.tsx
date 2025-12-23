"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeletePaymentCharge } from "@/hooks/payment-charges/use-payment-charges";
import type { PaymentMethodChargeConfig } from "@/lib/types/payment-charges";

interface PaymentFeesListProps {
  charges: PaymentMethodChargeConfig[];
  onEdit: (id: string) => void;
}

const METHOD_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  RAZORPAY_UPI: "UPI (Razorpay)",
  RAZORPAY_CARD: "Card (Razorpay)",
  STRIPE_CARD: "Card (Stripe)",
  WALLET: "Wallet",
  NETBANKING: "Net Banking",
  BNPL: "Buy Now Pay Later",
};

export function PaymentFeesList({ charges, onEdit }: PaymentFeesListProps) {
  const deleteCharge = useDeletePaymentCharge();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    await deleteCharge.mutateAsync(id);
    setDeletingId(null);
  };

  const formatAmount = (rupees: number) => {
    return `₹${rupees.toFixed(2)}`;
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Charge Type</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No payment charges configured
                </TableCell>
              </TableRow>
            ) : (
              charges.map((charge) => (
                <TableRow key={charge.id}>
                  <TableCell className="font-medium">
                    {METHOD_LABELS[charge.method] || charge.method}
                  </TableCell>
                  <TableCell>{charge.chargeType}</TableCell>
                  <TableCell>
                    {charge.chargeType === "FLAT" &&
                      formatAmount(charge.flatAmount)}
                    {charge.chargeType === "PERCENTAGE" &&
                      `${charge.percentage}%`}
                    {charge.chargeType === "MIXED" &&
                      `${charge.percentage}% + ${formatAmount(charge.flatAmount)}`}
                  </TableCell>
                  <TableCell>{charge.currency}</TableCell>
                  <TableCell>
                    <Badge variant={charge.active ? "default" : "secondary"}>
                      {charge.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(charge.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(charge.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Charge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment charge configuration?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
