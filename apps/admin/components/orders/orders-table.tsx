"use client";

import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Order } from "@/lib/types/orders";
import { DateTime } from "./date-time";
import { FulfillmentStatusBadge } from "./fulfillment-status-badge";
import { Money } from "./money";
import { OrderStatusBadge } from "./order-status-badge";
import { PaymentStatusBadge } from "./payment-status-badge";

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
}

export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  const router = useRouter();

  if (isLoading) {
    return null; // Skeleton handled by parent
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">No orders found</p>
        <p className="text-xs">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Payment Status</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="group cursor-pointer transition-colors duration-150"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <TableCell className="font-medium">
                <button
                  type="button"
                  className="hover:underline text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/orders/${order.id}`);
                  }}
                >
                  {order.orderNumber}
                </button>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs">
                    {order.customerName ||
                      order.customerEmail ||
                      "Guest Checkout"}
                  </span>
                  {order.customerEmail && order.customerName && (
                    <span className="text-[10px] text-muted-foreground">
                      {order.customerEmail}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Money amount={order.total} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    {order.paymentMethod || "N/A"}
                  </span>
                  {order.paymentMethod === "COD" && (
                    <span className="text-[10px] text-muted-foreground">
                      Cash on Delivery
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {order.paymentStatus ? (
                  <PaymentStatusBadge status={order.paymentStatus} />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>
                {order.fulfillmentStatus ? (
                  <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <DateTime date={order.createdAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
