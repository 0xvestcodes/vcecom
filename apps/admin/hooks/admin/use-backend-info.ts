"use client";

import { useQuery } from "@tanstack/react-query";

export interface BackendInfo {
  ok: boolean;
  version: string;
  buildEnv: string;
  commitHash: string;
  buildDate: string;
  runningSince?: string;
}

/**
 * Hook for fetching backend version and build information
 */
export function useBackendInfo() {
  return useQuery<BackendInfo>({
    queryKey: ["backend-info"],
    queryFn: async () => {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${API_URL}/`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch backend info");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
