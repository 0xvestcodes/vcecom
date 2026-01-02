"use client";

import {
  Archive,
  Copy,
  Download,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ActionDropdown,
  type ActionItem,
} from "@/components/common/action-dropdown";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { EditorPanel } from "@/components/layout/editor-panel";
import { OrderDetailSkeleton } from "@/components/skeletons/order-detail-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminOrder } from "@/hooks/orders/use-admin-order";
import { useAdminOrderTimeline } from "@/hooks/orders/use-admin-order-timeline";
import { useAdminPaymentReconcile } from "@/hooks/orders/use-admin-payment-reconcile";
import { useArchiveOrder } from "@/hooks/orders/use-archive-order";
import { useCancelOrder } from "@/hooks/orders/use-cancel-order";
import { useDuplicateOrder } from "@/hooks/orders/use-duplicate-order";
import { useUpdateOrderStatus } from "@/hooks/orders/use-update-order-status";
import type { OrderStatus } from "@/lib/types/orders";
import { FulfillmentControls } from "./fulfillment-controls";
import { NotesCard } from "./notes-card";
import { OrderActionsSheet } from "./order-actions-sheet";
import { OrderCustomerCard } from "./order-customer-card";
import { OrderDiscountSection } from "./order-discount-section";
import { OrderHeader } from "./order-header";
import { OrderLineItems } from "./order-line-items";
import { OrderPaymentSection } from "./order-payment-section";
import { OrderShippingSection } from "./order-shipping-section";
import { OrderSummary } from "./order-summary";
import { OrderTimelineLoadingSkeleton } from "./order-timeline-loading-skeleton";

// Lazy load heavy components
const OrderTimeline = dynamic(
  () =>
    import("./order-timeline").then((mod) => ({ default: mod.OrderTimeline })),
  { loading: () => <OrderTimelineLoadingSkeleton /> },
);

interface OrderEditorPanelProps {
  orderId: string;
}

/**
 * Refactored Order Editor Panel using EditorPanel layout
 * Uses collapsible sections instead of separate components
 */
export function OrderEditorPanel({ orderId }: OrderEditorPanelProps) {
  const router = useRouter();
  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
  } = useAdminOrder(orderId);
  const { data: timeline, isLoading: timelineLoading } =
    useAdminOrderTimeline(orderId);
  const updateStatusMutation = useUpdateOrderStatus();
  const archiveOrderMutation = useArchiveOrder();
  const cancelOrderMutation = useCancelOrder();
  const duplicateOrderMutation = useDuplicateOrder();
  const reconcilePaymentMutation = useAdminPaymentReconcile();

  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const handleStatusChange = useCallback(
    async (status: OrderStatus) => {
      if (!order) return;
      try {
        await updateStatusMutation.mutateAsync({
          orderId: order.id,
          status,
        });
        toast.success("Order status updated successfully");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update order status",
        );
      }
    },
    [order, updateStatusMutation],
  );

  const handleCopyOrderId = () => {
    if (order) {
      navigator.clipboard.writeText(order.id);
      toast.success("Order ID copied to clipboard");
    }
  };

  const handleCopyOrderNumber = () => {
    if (order) {
      navigator.clipboard.writeText(order.orderNumber);
      toast.success("Order number copied to clipboard");
    }
  };

  const handleDuplicate = async () => {
    if (!order) return;
    try {
      const duplicated = await duplicateOrderMutation.mutateAsync(order.id);
      toast.success("Order duplicated successfully");
      router.push(`/orders/${duplicated.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate order",
      );
    }
  };

  const handleArchive = async () => {
    if (!order) return;
    try {
      await archiveOrderMutation.mutateAsync(order.id);
      toast.success("Order archived successfully");
      setArchiveDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive order",
      );
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    try {
      await cancelOrderMutation.mutateAsync(order.id);
      toast.success("Order cancelled successfully");
      setCancelDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel order",
      );
    }
  };

  const handleReconcile = async () => {
    if (!order?.razorpayOrderId) return;
    try {
      await reconcilePaymentMutation.mutateAsync(order.id);
      toast.success("Payment reconciled successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reconcile payment",
      );
    }
  };

  if (orderLoading) {
    return (
      <EditorPanel title="Order" backHref="/orders">
        <OrderDetailSkeleton />
      </EditorPanel>
    );
  }

  if (orderError || !order) {
    return (
      <EditorPanel title="Order Not Found" backHref="/orders">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {orderError?.message || "Order not found"}
          </p>
        </div>
      </EditorPanel>
    );
  }

  const statusVariant =
    order.status === "delivered"
      ? "default"
      : order.status === "cancelled" || order.status === "refunded"
        ? "destructive"
        : order.status === "shipped"
          ? "default"
          : "secondary";

  const actions: ActionItem[] = [
    {
      label: "Copy Order ID",
      icon: <Copy className="h-4 w-4" />,
      onClick: handleCopyOrderId,
    },
    {
      label: "Copy Order Number",
      icon: <Copy className="h-4 w-4" />,
      onClick: handleCopyOrderNumber,
    },
    {
      label: "Download Invoice",
      icon: <Download className="h-4 w-4" />,
      onClick: () => {
        // TODO: Implement invoice download
        toast.info("Invoice download coming soon");
      },
    },
    {
      label: "Duplicate Order",
      icon: <RefreshCw className="h-4 w-4" />,
      onClick: handleDuplicate,
      disabled: duplicateOrderMutation.isPending,
    },
    {
      label: "More Actions",
      onClick: () => setActionsSheetOpen(true),
    },
  ];

  if (order.razorpayOrderId && order.paymentStatus !== "completed") {
    actions.push({
      label: "Reconcile Payment",
      icon: <RefreshCw className="h-4 w-4" />,
      onClick: handleReconcile,
      disabled: reconcilePaymentMutation.isPending,
    });
  }

  const canCancel =
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    order.status !== "delivered";

  return (
    <>
      <EditorPanel
        title={`Order ${order.orderNumber}`}
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: order.orderNumber },
        ]}
        status={{ label: order.status, variant: statusVariant }}
        backHref="/orders"
        sidebar={
          <>
            <OrderCustomerCard order={order} />
            <OrderSummary order={order} />
            <OrderPaymentSection order={order} />
            <FulfillmentControls
              currentStatus={order.status}
              onStatusChange={handleStatusChange}
              disabled={updateStatusMutation.isPending}
            />
            <div className="space-y-2">
              <ActionDropdown actions={actions} />
            </div>
          </>
        }
        warningActions={
          <div className="flex items-center gap-2">
            {canCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel Order
              </Button>
            )}
            {order.status !== "archived" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Order
              </Button>
            )}
          </div>
        }
      >
        {/* Line Items Section */}
        <CollapsibleSection title="Order Items" defaultOpen>
          <OrderLineItems order={order} />
        </CollapsibleSection>

        {/* Discount Section */}
        {order.discountCode && (
          <CollapsibleSection title="Discount" defaultOpen={false}>
            <OrderDiscountSection order={order} />
          </CollapsibleSection>
        )}

        {/* Shipping Section */}
        <CollapsibleSection title="Shipping" defaultOpen={false}>
          <OrderShippingSection order={order} />
        </CollapsibleSection>

        {/* Timeline Section */}
        <CollapsibleSection title="Order Timeline" defaultOpen={false}>
          <Suspense fallback={<OrderTimelineLoadingSkeleton />}>
            {timelineLoading ? (
              <OrderTimelineLoadingSkeleton />
            ) : timeline ? (
              <OrderTimeline timeline={timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No timeline data available
              </p>
            )}
          </Suspense>
        </CollapsibleSection>

        {/* Notes Section */}
        <CollapsibleSection title="Notes" defaultOpen={false}>
          <NotesCard orderId={order.id} />
        </CollapsibleSection>
      </EditorPanel>

      <OrderActionsSheet
        order={order}
        open={actionsSheetOpen}
        onOpenChange={setActionsSheetOpen}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action cannot be undone."
        confirmText="Cancel Order"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={cancelOrderMutation.isPending}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Order"
        description="Are you sure you want to archive this order? It will be moved to archived orders."
        confirmText="Archive"
        onConfirm={handleArchive}
        isLoading={archiveOrderMutation.isPending}
      />
    </>
  );
}
