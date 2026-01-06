"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import type { WalletBalance } from "./use-admin-wallet";

export interface CreditWalletInput {
  amount: number;
  description: string;
  orderId?: string;
  refundId?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitWalletInput {
  amount: number;
  description: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

export function useCreditWallet(customerId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<WalletBalance, CreditWalletInput>({
    mutationFn: async (data) => {
      return api.post<WalletBalance>(endpoints.wallet.credit(customerId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.customer(customerId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.transactions],
      });
      toast.success("Wallet credited successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to credit wallet");
    },
  });
}

export function useDebitWallet(customerId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<WalletBalance, DebitWalletInput>({
    mutationFn: async (data) => {
      return api.post<WalletBalance>(endpoints.wallet.debit(customerId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.customer(customerId)],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.transactions],
      });
      toast.success("Wallet debited successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to debit wallet");
    },
  });
}
