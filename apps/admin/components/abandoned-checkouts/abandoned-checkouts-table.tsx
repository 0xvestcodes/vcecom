"use client";

import { useRouter } from "next/navigation";
import { DateTime } from "@/components/orders/date-time";
import { Money } from "@/components/orders/money";
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
import type { AbandonedCheckout } from "@/lib/types/abandoned-checkouts";

interface AbandonedCheckoutsTableProps {
  checkouts: AbandonedCheckout[];
  isLoading?: boolean;
  onConvert?: (checkout: AbandonedCheckout) => void;
}

export function AbandonedCheckoutsTable({
  checkouts,
  isLoading,
  onConvert,
}: AbandonedCheckoutsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return null; // Skeleton handled by parent
  }

  if (checkouts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <p className="text-sm font-medium mb-1">No abandoned checkouts found</p>
        <p className="text-xs">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cart ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checkouts.map((checkout) => (
            <TableRow
              key={checkout.id}
              className="group cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() =>
                router.push(`/orders/abandoned/${checkout.cartId}`)
              }
            >
              <TableCell className="font-mono text-xs">
                {checkout.cartId.slice(0, 8)}...
              </TableCell>
              <TableCell className="text-xs">
                {checkout.customerId ? "Customer" : "Guest"}
              </TableCell>
              <TableCell className="text-xs">
                {checkout.customerEmail || (
                  <span className="text-muted-foreground">No email</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <Money amount={checkout.total} />
              </TableCell>
              <TableCell className="text-xs">{checkout.items.length}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="outline" className="text-xs">
                  {checkout.checkoutState}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                <DateTime date={checkout.createdAt} />
              </TableCell>
              <TableCell
                className="text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                {checkout.paymentIntentId && onConvert && (
                  <Button
                    size="sm"
                    onClick={() => onConvert(checkout)}
                    variant="outline"
                    className="text-xs h-8"
                  >
                    Convert to Order
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
