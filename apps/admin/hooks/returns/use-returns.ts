"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
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
  requestedAt: Date;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  trackingNumber?: string | null;
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    reason: string;
    condition: string;
    refundAmount: number;
    status: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface ListReturnsParams {
  status?: string;
  orderId?: string;
  customerId?: string;
}

export function useReturns(params?: ListReturnsParams) {
  const queryString = params
    ? new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined) as [
          string,
          string,
        ][],
      ).toString()
    : "";

  return useApiQuery<ReturnRequest[]>(
    `/api/admin/returns${queryString ? `?${queryString}` : ""}`,
  );
}

export function useReturn(returnId: string) {
  return useApiQuery<ReturnRequest>(`/api/admin/returns/${returnId}`, {
    enabled: !!returnId,
  });
}

export function useApproveReturn() {
  const queryClient = useQueryClient();

  return useApiMutation<
    ReturnRequest,
    { returnId: string; data: { returnAddressId?: string; notes?: string } }
  >({
    mutationFn: async ({ returnId, data }) => {
      return api.post<ReturnRequest>(
        `/api/admin/returns/${returnId}/approve`,
        data,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/returns"] });
      toast.success("Return request approved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve return request");
    },
  });
}

export function useRejectReturn() {
  const queryClient = useQueryClient();

  return useApiMutation<ReturnRequest, { returnId: string; reason: string }>({
    mutationFn: async ({ returnId, reason }) => {
      return api.post<ReturnRequest>(`/api/admin/returns/${returnId}/reject`, {
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/returns"] });
      toast.success("Return request rejected");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject return request");
    },
  });
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();

  return useApiMutation<
    ReturnRequest,
    {
      returnId: string;
      status: ReturnRequest["status"];
      trackingNumber?: string;
      notes?: string;
    }
  >({
    mutationFn: async ({ returnId, status, trackingNumber, notes }) => {
      return api.patch<ReturnRequest>(`/api/admin/returns/${returnId}`, {
        status,
        trackingNumber,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/returns"] });
      toast.success("Return status updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update return status");
    },
  });
}
