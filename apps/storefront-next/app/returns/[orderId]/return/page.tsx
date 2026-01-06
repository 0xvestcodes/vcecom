"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OrderItem {
  id: string;
  productVariantId: string;
  quantity: number;
  price: number;
}

export default function ReturnRequestPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [returnQuantities, setReturnQuantities] = useState<
    Record<string, number>
  >({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<
    Record<string, "new" | "damaged" | "defective" | "other">
  >({});
  const [generalReason, setGeneralReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load order data
  useEffect(() => {
    let mounted = true;

    (async () => {
      const resolvedParams = await params;
      const id = resolvedParams.orderId;
      if (!mounted) return;
      setOrderId(id);

      // Fetch order items
      try {
        const response = await fetch(`/api/orders/${id}`, {
          credentials: "include",
        });
        if (response.ok && mounted) {
          const order = await response.json();
          if (order?.items) {
            setOrderItems(order.items);
            // Initialize quantities with max available
            const initialQuantities: Record<string, number> = {};
            const initialConditions: Record<
              string,
              "new" | "damaged" | "defective" | "other"
            > = {};
            order.items.forEach((item: OrderItem) => {
              initialQuantities[item.id] = item.quantity;
              initialConditions[item.id] = "other";
            });
            setReturnQuantities(initialQuantities);
            setConditions(initialConditions);
          }
        }
      } catch (_error) {
        if (mounted) {
          toast.error("Failed to load order details");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [params]);

  if (isLoading) {
    return (
      <div className="container py-10">
        <div>Loading order details...</div>
      </div>
    );
  }

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    const item = orderItems.find((i) => i.id === itemId);
    if (item && quantity >= 1 && quantity <= item.quantity) {
      setReturnQuantities((prev) => ({ ...prev, [itemId]: quantity }));
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    if (!generalReason.trim()) {
      toast.error("Please provide a reason for the return");
      return;
    }

    setIsSubmitting(true);

    try {
      const items = Array.from(selectedItems).map((itemId) => ({
        orderItemId: itemId,
        quantity: returnQuantities[itemId] || 1,
        reason: reasons[itemId] || generalReason,
        condition: conditions[itemId] || "other",
      }));

      const response = await fetch(`/api/orders/${orderId}/returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          reason: generalReason,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create return request");
      }

      const returnRequest = await response.json();
      toast.success("Return request created successfully");
      router.push(`/returns/${returnRequest.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create return request",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Request Return</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Items to Return</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderItems.map((item) => (
            <div key={item.id} className="flex items-start gap-4 border-b pb-4">
              <Checkbox
                checked={selectedItems.has(item.id)}
                onCheckedChange={() => handleItemToggle(item.id)}
              />
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">
                      Item {item.id.substring(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Price: ₹{item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Ordered: {item.quantity}</p>
                  </div>
                </div>

                {selectedItems.has(item.id) && (
                  <div className="mt-4 space-y-2">
                    <div>
                      <Label>Return Quantity</Label>
                      <input
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={returnQuantities[item.id] || 1}
                        onChange={(e) =>
                          handleQuantityChange(
                            item.id,
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                        className="w-20 rounded border p-1"
                      />
                    </div>

                    <div>
                      <Label>Condition</Label>
                      <select
                        value={conditions[item.id] || "other"}
                        onChange={(e) =>
                          setConditions((prev) => ({
                            ...prev,
                            [item.id]: e.target.value as
                              | "new"
                              | "damaged"
                              | "defective"
                              | "other",
                          }))
                        }
                        className="w-full rounded border p-2"
                      >
                        <option value="new">New</option>
                        <option value="damaged">Damaged</option>
                        <option value="defective">Defective</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <Label>Reason (optional)</Label>
                      <Textarea
                        value={reasons[item.id] || ""}
                        onChange={(e) =>
                          setReasons((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Specific reason for this item"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Return Reason</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>General reason for return</Label>
          <Textarea
            value={generalReason}
            onChange={(e) => setGeneralReason(e.target.value)}
            placeholder="Please provide a reason for your return request"
            rows={4}
            required
          />
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-4">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Return Request"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
