"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import type { TaxExemption } from "@/lib/types/tax";

const TAX_EXEMPTIONS_QUERY_KEY = ["tax-exemptions"];

async function fetchTaxExemptions(): Promise<TaxExemption[]> {
  const response = await fetch(endpoints.tax.exemptions.list, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax exemptions");
  }
  return response.json();
}

async function fetchTaxExemption(id: string): Promise<TaxExemption> {
  const response = await fetch(endpoints.tax.exemptions.detail(id), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch tax exemption");
  }
  return response.json();
}

async function createTaxExemption(data: {
  name: string;
  description?: string;
  exemptionType: string;
  entityId: string;
  exemptionReason?: string;
  certificateNumber?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}): Promise<TaxExemption> {
  const response = await fetch(endpoints.tax.exemptions.create, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create tax exemption");
  }
  return response.json();
}

async function updateTaxExemption(
  id: string,
  data: {
    name?: string;
    description?: string;
    exemptionReason?: string;
    certificateNumber?: string;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  },
): Promise<TaxExemption> {
  const response = await fetch(endpoints.tax.exemptions.update(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update tax exemption");
  }
  return response.json();
}

async function deleteTaxExemption(id: string): Promise<void> {
  const response = await fetch(endpoints.tax.exemptions.delete(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete tax exemption");
  }
}

export function useAdminTaxExemptions() {
  return useQuery({
    queryKey: TAX_EXEMPTIONS_QUERY_KEY,
    queryFn: fetchTaxExemptions,
  });
}

export function useAdminTaxExemption(id: string) {
  return useQuery({
    queryKey: [...TAX_EXEMPTIONS_QUERY_KEY, id],
    queryFn: () => fetchTaxExemption(id),
    enabled: !!id,
  });
}

export function useCreateTaxExemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTaxExemption,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_EXEMPTIONS_QUERY_KEY });
    },
  });
}

export function useUpdateTaxExemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateTaxExemption>[1];
    }) => updateTaxExemption(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_EXEMPTIONS_QUERY_KEY });
    },
  });
}

export function useDeleteTaxExemption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTaxExemption,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_EXEMPTIONS_QUERY_KEY });
    },
  });
}
