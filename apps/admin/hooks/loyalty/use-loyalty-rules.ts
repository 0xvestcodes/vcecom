"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export interface LoyaltyRule {
  id: string;
  name: string;
  type: "earning" | "redemption";
  ruleType: "percentage" | "fixed" | "tiered";
  pointsPerRupee: number;
  rupeesPerPoint: number;
  minOrderValue: number;
  minPointsToRedeem: number;
  maxPointsPerOrder?: number;
  isActive: boolean;
  validFrom: Date;
  validUntil?: Date;
  customerGroupId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoyaltyRuleInput {
  name: string;
  type: "earning" | "redemption";
  ruleType: "percentage" | "fixed" | "tiered";
  pointsPerRupee?: number;
  rupeesPerPoint?: number;
  minOrderValue?: number;
  minPointsToRedeem?: number;
  maxPointsPerOrder?: number;
  validFrom?: string;
  validUntil?: string;
  customerGroupId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateLoyaltyRuleInput {
  name?: string;
  isActive?: boolean;
  pointsPerRupee?: number;
  rupeesPerPoint?: number;
  minOrderValue?: number;
  minPointsToRedeem?: number;
  maxPointsPerOrder?: number;
  validFrom?: string;
  validUntil?: string;
  customerGroupId?: string;
  metadata?: Record<string, unknown>;
}

export function useLoyaltyRules(params?: {
  type?: "earning" | "redemption";
  isActive?: boolean;
}) {
  return useApiQuery<LoyaltyRule[]>(endpoints.wallet.rules.list, {
    params,
  });
}

export function useLoyaltyRule(ruleId: string) {
  return useApiQuery<LoyaltyRule>(endpoints.wallet.rules.detail(ruleId), {
    enabled: !!ruleId,
  });
}

export function useCreateLoyaltyRule() {
  const queryClient = useQueryClient();

  return useApiMutation<LoyaltyRule, CreateLoyaltyRuleInput>({
    mutationFn: async (data) => {
      return api.post<LoyaltyRule>(endpoints.wallet.rules.create, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.rules.list],
      });
      toast.success("Loyalty rule created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create loyalty rule");
    },
  });
}

export function useUpdateLoyaltyRule(ruleId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<LoyaltyRule, UpdateLoyaltyRuleInput>({
    mutationFn: async (data) => {
      return api.put<LoyaltyRule>(endpoints.wallet.rules.update(ruleId), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.rules.list],
      });
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.rules.detail(ruleId)],
      });
      toast.success("Loyalty rule updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update loyalty rule");
    },
  });
}

export function useDeleteLoyaltyRule() {
  const queryClient = useQueryClient();

  return useApiMutation<void, string>({
    mutationFn: async (ruleId) => {
      return api.delete<void>(endpoints.wallet.rules.delete(ruleId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [endpoints.wallet.rules.list],
      });
      toast.success("Loyalty rule deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete loyalty rule");
    },
  });
}
