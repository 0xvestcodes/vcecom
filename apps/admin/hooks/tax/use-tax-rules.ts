"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import type { TaxRule } from "@/lib/types/tax";

const TAX_RULES_QUERY_KEY = ["tax-rules"];

async function fetchTaxRules(): Promise<TaxRule[]> {
  const response = await fetch(endpoints.tax.rules.list, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax rules");
  }
  return response.json();
}

async function fetchTaxRule(id: string): Promise<TaxRule> {
  const response = await fetch(endpoints.tax.rules.detail(id), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax rule");
  }
  return response.json();
}

async function createTaxRule(data: {
  name: string;
  description?: string;
  ruleType: string;
  entityId: string;
  gstRate: number;
  priority?: number;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}): Promise<TaxRule> {
  const response = await fetch(endpoints.tax.rules.create, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create tax rule");
  }
  return response.json();
}

async function updateTaxRule(
  id: string,
  data: {
    name?: string;
    description?: string;
    gstRate?: number;
    priority?: number;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  },
): Promise<TaxRule> {
  const response = await fetch(endpoints.tax.rules.update(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update tax rule");
  }
  return response.json();
}

async function deleteTaxRule(id: string): Promise<void> {
  const response = await fetch(endpoints.tax.rules.delete(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete tax rule");
  }
}

export function useAdminTaxRules() {
  return useQuery({
    queryKey: TAX_RULES_QUERY_KEY,
    queryFn: fetchTaxRules,
  });
}

export function useAdminTaxRule(id: string) {
  return useQuery({
    queryKey: [...TAX_RULES_QUERY_KEY, id],
    queryFn: () => fetchTaxRule(id),
    enabled: !!id,
  });
}

export function useCreateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTaxRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_RULES_QUERY_KEY });
    },
  });
}

export function useUpdateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateTaxRule>[1];
    }) => updateTaxRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_RULES_QUERY_KEY });
    },
  });
}

export function useDeleteTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTaxRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_RULES_QUERY_KEY });
    },
  });
}
