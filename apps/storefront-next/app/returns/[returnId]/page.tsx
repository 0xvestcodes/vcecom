"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

interface ReturnRequest {
  id: string;
  rmaNumber: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "in_transit"
    | "received"
    | "processing_refund"
    | "completed"
    | "cancelled";
  reason: string;
  requestedAt: string;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  trackingNumber?: string | null;
  items: Array<{
    id: string;
    quantity: number;
    reason: string;
    condition: string;
    refundAmount: number;
  }>;
}

export default function ReturnStatusPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const [_returnId, setReturnId] = useState<string | null>(null);
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const resolvedParams = await params;
      const id = resolvedParams.returnId;
      setReturnId(id);

      try {
        const response = await fetch(`/api/returns/${id}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load return request");
        }

        const data = await response.json();
        setReturnRequest(data);
      } catch (error) {
        console.error("Failed to load return request:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params]);

  if (isLoading) {
    return (
      <div className="container py-10">
        <div>Loading...</div>
      </div>
    );
  }

  if (!returnRequest) {
    return (
      <div className="container py-10">
        <div>Return request not found</div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Return Request Status</h1>

      <Card>
        <CardHeader>
          <CardTitle>Return Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">RMA Number</div>
            <p className="text-lg font-semibold">{returnRequest.rmaNumber}</p>
          </div>

          <div>
            <div className="text-sm font-medium">Status</div>
            <div className="mt-1">
              <Badge
                className={
                  STATUS_COLORS[returnRequest.status] ||
                  "bg-gray-100 text-gray-800"
                }
              >
                {returnRequest.status.replace(/_/g, " ").toUpperCase()}
              </Badge>
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

          {returnRequest.rejectionReason && (
            <div>
              <div className="text-sm font-medium">Rejection Reason</div>
              <p className="text-sm text-red-600">
                {returnRequest.rejectionReason}
              </p>
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

          <div className="pt-4">
            <h3 className="font-medium mb-2">Return Instructions</h3>
            {returnRequest.status === "approved" && (
              <div className="text-sm space-y-2">
                <p>
                  Your return request has been approved. Please ship the items
                  back to us using the provided return address.
                </p>
                {returnRequest.trackingNumber && (
                  <p>
                    Tracking Number:{" "}
                    <span className="font-medium">
                      {returnRequest.trackingNumber}
                    </span>
                  </p>
                )}
              </div>
            )}

            {returnRequest.status === "in_transit" && (
              <p className="text-sm">
                Your return is in transit. We will process your refund once we
                receive the items.
              </p>
            )}

            {returnRequest.status === "received" && (
              <p className="text-sm">
                We have received your return. We are inspecting the items and
                will process your refund shortly.
              </p>
            )}

            {returnRequest.status === "processing_refund" && (
              <p className="text-sm">
                Your refund is being processed. You will receive the refund
                within 5-7 business days.
              </p>
            )}

            {returnRequest.status === "completed" && (
              <p className="text-sm text-green-600">
                Your return has been completed and refund has been processed.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
