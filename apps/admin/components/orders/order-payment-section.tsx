"use client";

import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedButton } from "@/components/common/protected-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAdminPaymentReconcile } from "@/hooks/orders/use-admin-payment-reconcile";
import { useAdminRefunds } from "@/hooks/orders/use-admin-refunds";
import { useMarkOrderPaid } from "@/hooks/orders/use-mark-order-paid";
import type { Order } from "@/lib/types/orders";
import { FeeBreakdownDisplay } from "./fee-breakdown-display";
import { Money } from "./money";
import { PaymentStatusBadge } from "./payment-status-badge";
import { RefundDialog } from "./refund-dialog";

interface OrderPaymentSectionProps {
  order: Order;
}

export function OrderPaymentSection({ order }: OrderPaymentSectionProps) {
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const isCOD = order.paymentMethod === "COD";
  const isPaid = order.paymentStatus === "completed";
  const canReconcile = order.razorpayOrderId && !isPaid;
  const canMarkPaid = isCOD && !isPaid;
  const canRefund = isPaid && order.status !== "refunded";

  const reconcileMutation = useAdminPaymentReconcile();
  const markPaidMutation = useMarkOrderPaid();
  const { data: refunds } = useAdminRefunds(order.id);

  const handleReconcile = async () => {
    if (!order.razorpayOrderId) return;
    try {
      await reconcileMutation.mutateAsync({
        paymentIntentId: order.razorpayOrderId,
        provider: "razorpay",
      });
      setReconcileDialogOpen(false);
    } catch (_error) {
      // Error handled by mutation hook
    }
  };

  const handleMarkPaid = async () => {
    try {
      await markPaidMutation.mutateAsync({ orderId: order.id });
    } catch (_error) {
      // Error handled by mutation hook
    }
  };

  const handleCopyPaymentIntentId = () => {
    if (order.razorpayOrderId) {
      navigator.clipboard.writeText(order.razorpayOrderId);
      toast.success("Payment Intent ID copied to clipboard");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Payment Method</span>
          <span className="font-medium">{order.paymentMethod || "N/A"}</span>
        </div>

        {order.paymentStatus && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Payment Status
            </span>
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Provider</span>
          <span className="text-sm font-medium">
            {order.razorpayOrderId ? "Razorpay" : "N/A"}
          </span>
        </div>

        {order.razorpayOrderId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Payment Intent ID
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{order.razorpayOrderId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopyPaymentIntentId}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {refunds && refunds.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-sm font-medium">Refunds</p>
            {refunds.map((refund) => (
              <div
                key={refund.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="text-muted-foreground">
                    {refund.status === "completed"
                      ? "Refunded"
                      : "Refund Pending"}
                  </span>
                  {refund.reason && (
                    <p className="text-xs text-muted-foreground">
                      {refund.reason}
                    </p>
                  )}
                </div>
                <Money amount={refund.amount} />
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-medium pt-1 border-t">
              <span>Total Refunded</span>
              <Money amount={refunds.reduce((sum, r) => sum + r.amount, 0)} />
            </div>
          </div>
        )}

        {order.paymentFee && order.paymentFee > 0 && (
          <div className="pt-2 border-t">
            <FeeBreakdownDisplay
              paymentFee={order.paymentFee}
              paymentFeeBreakdown={order.paymentFeeBreakdown}
              paymentMethod={order.paymentMethod || undefined}
            />
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Amount</span>
            <Money amount={order.total} />
          </div>
          {isPaid && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Amount Paid</span>
              <Money amount={order.total} />
            </div>
          )}
          {!isPaid && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Remaining</span>
              <Money amount={order.total} />
            </div>
          )}
          {refunds && refunds.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Remaining After Refunds</span>
              <Money
                amount={
                  order.total - refunds.reduce((sum, r) => sum + r.amount, 0)
                }
              />
            </div>
          )}
        </div>

        <div className="pt-2 space-y-2">
          {canReconcile && (
            <Dialog
              open={reconcileDialogOpen}
              onOpenChange={setReconcileDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reconcile Payment Intent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reconcile Payment Intent</DialogTitle>
                  <DialogDescription>
                    This will manually reprocess the payment intent to create or
                    update the order. This is safe to call multiple times and is
                    idempotent.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setReconcileDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReconcile}
                    disabled={reconcileMutation.isPending}
                  >
                    {reconcileMutation.isPending
                      ? "Reconciling..."
                      : "Reconcile"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canMarkPaid && (
            <ProtectedButton requiredRoles={["admin", "support"]}>
              <Button
                className="w-full"
                variant="default"
                onClick={handleMarkPaid}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending ? "Marking..." : "Mark COD as Paid"}
              </Button>
            </ProtectedButton>
          )}

          {canRefund && (
            <ProtectedButton requiredRoles={["admin", "support"]}>
              <RefundDialog order={order} />
            </ProtectedButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
