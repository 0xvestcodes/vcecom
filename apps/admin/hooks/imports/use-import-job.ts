import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, FetchError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export interface ImportJob {
  id: string;
  type: "products" | "categories" | "inventory" | "customers";
  source: "csv" | "excel" | "json" | "shopify" | "api";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  fileUrl?: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  createdAt: string;
}

export interface ImportJobStatus extends ImportJob {
  errorCount: number;
  updatedAt: string;
  completedAt?: string;
}

export interface ImportJobError {
  id: string;
  rowNumber: number;
  field: string | null;
  value: string | null;
  errorCode: string;
  errorMessage: string;
  rawData: unknown;
  createdAt: string;
}

export interface CreateImportJobData {
  type: "products" | "categories" | "inventory" | "customers";
  source: "csv" | "excel" | "json";
  file: File;
  options?: {
    skipErrors?: boolean;
    updateExisting?: boolean;
    dryRun?: boolean;
  };
}

export function useImportJob(jobId: string) {
  return useQuery<ImportJobStatus, FetchError>({
    queryKey: ["imports", jobId],
    queryFn: () =>
      api.get<ImportJobStatus>(`${endpoints.imports.status(jobId)}`),
    refetchInterval: (query) => {
      // Poll every 2 seconds if job is still processing
      const data = query.state.data;
      if (data?.status === "processing" || data?.status === "pending") {
        return 2000;
      }
      return false;
    },
  });
}

export function useImportJobErrors(jobId: string, limit = 100, offset = 0) {
  return useQuery<ImportJobError[], FetchError>({
    queryKey: ["imports", jobId, "errors", limit, offset],
    queryFn: () =>
      api.get<ImportJobError[]>(
        `${endpoints.imports.errors(jobId)}?limit=${limit}&offset=${offset}`,
      ),
  });
}

export function useCreateImportJob() {
  const queryClient = useQueryClient();

  return useMutation<ImportJob, FetchError, CreateImportJobData>({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("type", data.type);
      formData.append("source", data.source);
      if (data.options) {
        formData.append("options", JSON.stringify(data.options));
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${baseUrl}${endpoints.imports.create}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new FetchError(
          error.message || "Failed to create import job",
          response.status,
          error.errors,
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });
}
