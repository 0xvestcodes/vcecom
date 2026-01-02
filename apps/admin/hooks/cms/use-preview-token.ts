import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

interface GeneratePreviewTokenDto {
  entryId?: string;
  contentTypeId?: string;
}

interface PreviewTokenResponse {
  token: string;
  expiresAt: string;
}

/**
 * Hook for generating preview tokens
 */
export function useGeneratePreviewToken() {
  return useMutation({
    mutationFn: async (data: GeneratePreviewTokenDto) => {
      const response = await api.post<PreviewTokenResponse>(
        endpoints.cms.preview.generateToken,
        data,
      );
      return response.data;
    },
  });
}

/**
 * Hook for validating preview tokens
 */
export function useValidatePreviewToken(token: string | null) {
  return useQuery({
    queryKey: ["preview-token", token],
    queryFn: async () => {
      if (!token) return null;
      const response = await api.get(
        endpoints.cms.preview.validateToken(token),
      );
      return response.data;
    },
    enabled: !!token,
  });
}
