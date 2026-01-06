"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/endpoints";
import type { HsnCode } from "@/lib/types/tax";

const HSN_CODES_QUERY_KEY = ["hsn-codes"];

async function fetchHsnCodes(): Promise<HsnCode[]> {
  const response = await fetch(endpoints.tax.hsnCodes.list, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch HSN codes");
  }
  return response.json();
}

async function fetchHsnCode(id: string): Promise<HsnCode> {
  const response = await fetch(endpoints.tax.hsnCodes.detail(id), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch HSN code");
  }
  return response.json();
}

async function createHsnCode(data: {
  hsnCode: string;
  description?: string;
  gstRate?: number;
}): Promise<HsnCode> {
  const response = await fetch(endpoints.tax.hsnCodes.create, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create HSN code");
  }
  return response.json();
}

async function updateHsnCode(
  id: string,
  data: {
    description?: string;
    gstRate?: number;
    isActive?: boolean;
  },
): Promise<HsnCode> {
  const response = await fetch(endpoints.tax.hsnCodes.update(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update HSN code");
  }
  return response.json();
}

async function deleteHsnCode(id: string): Promise<void> {
  const response = await fetch(endpoints.tax.hsnCodes.delete(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to delete HSN code");
  }
}

export function useAdminHsnCodes() {
  return useQuery({
    queryKey: HSN_CODES_QUERY_KEY,
    queryFn: fetchHsnCodes,
  });
}

export function useAdminHsnCode(id: string) {
  return useQuery({
    queryKey: [...HSN_CODES_QUERY_KEY, id],
    queryFn: () => fetchHsnCode(id),
    enabled: !!id,
  });
}

export function useCreateHsnCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHsnCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HSN_CODES_QUERY_KEY });
    },
  });
}

export function useUpdateHsnCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateHsnCode>[1];
    }) => updateHsnCode(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HSN_CODES_QUERY_KEY });
    },
  });
}

export function useDeleteHsnCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteHsnCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HSN_CODES_QUERY_KEY });
    },
  });
}
