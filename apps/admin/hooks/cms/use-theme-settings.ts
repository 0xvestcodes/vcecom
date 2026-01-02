"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import type { ThemeSettingsDto } from "@/lib/types/themes";

/**
 * Hook for fetching theme settings
 */
export function useThemeSettings(themeId: string) {
  return useQuery({
    queryKey: ["theme-settings", themeId],
    queryFn: async () => {
      const response = await api.get(endpoints.cms.themes.settings(themeId));
      return response;
    },
    enabled: !!themeId,
  });
}

/**
 * Hook for updating theme settings
 */
export function useUpdateThemeSettings(themeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: ThemeSettingsDto) => {
      const response = await api.put<ThemeSettingsDto>(
        endpoints.cms.themes.settings(themeId),
        { settings },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["theme-settings", themeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["themes"],
      });
      toast.success("Theme settings updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update theme settings");
    },
  });
}

/**
 * Hook for activating a theme
 */
export function useActivateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (themeId: string) => {
      const response = await api.put(
        endpoints.cms.themes.activate(themeId),
        {},
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["themes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["theme-settings"],
      });
      toast.success("Theme activated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to activate theme");
    },
  });
}

/**
 * Hook for listing available themes
 */
export function useThemes() {
  return useQuery({
    queryKey: ["themes"],
    queryFn: async () => {
      const response = await api.get(endpoints.cms.themes.list);
      return response;
    },
  });
}
