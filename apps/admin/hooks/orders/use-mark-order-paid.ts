"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { Order } from "@/lib/types/orders";
import { useApiMutation } from "../use-api-mutation";

interface MarkOrderPaidParams {
  orderId: string;
}

export function useMarkOrderPaid() {
  const queryClient = useQueryClient();

  return useApiMutation<Order, MarkOrderPaidParams>({
    mutationFn: async ({ orderId }) => {
      return api.post<Order>(endpoints.orders.markPaid(orderId));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.orders.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.orders.detail(data.id)],
      });
      toast.success("Order marked as paid successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark order as paid");
    },
  });
}
