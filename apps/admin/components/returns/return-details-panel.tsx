"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReturnRequest } from "@/hooks/returns/use-returns";
import { useReturn, useUpdateReturnStatus } from "@/hooks/returns/use-returns";

const STATUS_COLORS: Record<
  | "pending"
  | "approved"
  | "rejected"
  | "in_transit"
  | "received"
  | "processing_refund"
  | "completed"
  | "cancelled",
  string
> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  in_transit: "bg-purple-100 text-purple-800",
  received: "bg-green-100 text-green-800",
  processing_refund: "bg-orange-100 text-orange-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function ReturnStatusBadge({
  status,
}: {
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "in_transit"
    | "received"
    | "processing_refund"
    | "completed"
    | "cancelled";
}) {
  return (
    <Badge className={STATUS_COLORS[status] || "bg-gray-100 text-gray-800"}>
      {status.replace(/_/g, " ").toUpperCase()}
    </Badge>
  );
}

interface ReturnDetailsPanelProps {
  returnId: string;
}

export function ReturnDetailsPanel({ returnId }: ReturnDetailsPanelProps) {
  const _router = useRouter();
  const { data: returnRequest, isLoading } = useReturn(returnId);
  const updateStatus = useUpdateReturnStatus();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!returnRequest) {
    return <div>Return request not found</div>;
  }

  const handleStatusUpdate = async (
    status: ReturnRequest["status"],
    trackingNumber?: string,
  ) => {
    await updateStatus.mutateAsync({
      returnId,
      status,
      trackingNumber,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Return Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">RMA Number</div>
            <p className="text-lg font-semibold">{returnRequest.rmaNumber}</p>
          </div>

          <div>
            <div className="text-sm font-medium">Status</div>
            <div className="mt-1">
              <ReturnStatusBadge status={returnRequest.status} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Reason</div>
            <p className="text-sm">{returnRequest.reason}</p>
          </div>

          <div>
            <div className="text-sm font-medium">Requested At</div>
            <p className="text-sm">
              {new Date(returnRequest.requestedAt).toLocaleString()}
            </p>
          </div>

          {returnRequest.trackingNumber && (
            <div>
              <div className="text-sm font-medium">Tracking Number</div>
              <p className="text-sm">{returnRequest.trackingNumber}</p>
            </div>
          )}

          <div>
            <div className="text-sm font-medium">Items Being Returned</div>
            <div className="mt-2 space-y-2">
              {returnRequest.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between border-b pb-2"
                >
                  <div>
                    <p className="text-sm">Quantity: {item.quantity}</p>
                    <p className="text-xs text-muted-foreground">
                      Condition: {item.condition}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reason: {item.reason}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      ₹{item.refundAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {returnRequest.status === "pending" && (
              <>
                <Button
                  onClick={() => handleStatusUpdate("approved")}
                  variant="default"
                >
                  Approve
                </Button>
                <Button
                  onClick={() => handleStatusUpdate("rejected")}
                  variant="destructive"
                >
                  Reject
                </Button>
              </>
            )}

            {returnRequest.status === "approved" && (
              <Button
                onClick={() => handleStatusUpdate("in_transit")}
                variant="default"
              >
                Mark In Transit
              </Button>
            )}

            {returnRequest.status === "in_transit" && (
              <Button
                onClick={() => handleStatusUpdate("received")}
                variant="default"
              >
                Mark Received
              </Button>
            )}

            {returnRequest.status === "received" && (
              <Button
                onClick={() => handleStatusUpdate("processing_refund")}
                variant="default"
              >
                Process Refund
              </Button>
            )}

            {returnRequest.status === "processing_refund" && (
              <Button
                onClick={() => handleStatusUpdate("completed")}
                variant="default"
              >
                Mark Completed
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
