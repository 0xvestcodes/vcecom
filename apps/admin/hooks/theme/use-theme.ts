"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
}

export interface ThemeTypography {
  fontSans: string;
  fontSerif: string;
}

export interface Theme {
  colors: ThemeColors;
  sectionPadding: "xs" | "sm" | "md" | "lg" | "xl";
  globalRadius: "none" | "sm" | "md" | "lg" | "full";
  typography: ThemeTypography;
}

export interface UpdateThemeInput {
  colors: ThemeColors;
  sectionPadding: "xs" | "sm" | "md" | "lg" | "xl";
  globalRadius: "none" | "sm" | "md" | "lg" | "full";
  typography: ThemeTypography;
}

/**
 * Hook to fetch theme settings
 */
export function useTheme() {
  return useApiQuery<Theme>(endpoints.theme.get, {
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to fetch theme CSS
 */
export function useThemeCSS() {
  return useApiQuery<string>(endpoints.theme.css, {
    staleTime: 5 * 60 * 1000,
    select: (data) => data as string,
  });
}

/**
 * Hook to update theme settings
 */
export function useUpdateTheme() {
  const queryClient = useQueryClient();

  return useApiMutation<Theme, UpdateThemeInput>({
    mutationFn: async (data) => {
      return api.post<Theme>(endpoints.theme.update, data);
    },
    onSuccess: () => {
      // Invalidate theme queries
      queryClient.invalidateQueries({ queryKey: [endpoints.theme.get] });
      queryClient.invalidateQueries({ queryKey: [endpoints.theme.css] });
      toast.success("Theme updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update theme");
    },
  });
}
