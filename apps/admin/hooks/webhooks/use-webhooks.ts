import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

export interface Webhook {
  id: string;
  storeId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  timeoutMs: number;
  retryConfig: {
    maxAttempts: number;
    backoffMs: number[];
  };
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: string;
  eventId: string;
  status: "pending" | "success" | "failed";
  attemptCount: number;
  responseStatus?: number;
  responseBody?: string;
  requestBody: Record<string, unknown>;
  errorMessage?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface IncomingWebhook {
  id: string;
  storeId: string;
  provider: "razorpay" | "shiprocket" | "nimbus_post" | "generic";
  eventType: string;
  payload: Record<string, unknown>;
  signature?: string;
  headers?: Record<string, string>;
  status: "pending" | "processed" | "failed";
  processedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: string[];
  secret: string;
  isActive?: boolean;
  timeoutMs?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number[];
  };
  headers?: Record<string, string>;
}

export interface UpdateWebhookDto {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
  timeoutMs?: number;
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number[];
  };
  headers?: Record<string, string>;
}

export interface QueryWebhooksParams {
  storeId?: string;
  isActive?: boolean;
  eventType?: string;
  page?: number;
  pageSize?: number;
}

export interface QueryWebhookLogsParams {
  status?: "pending" | "success" | "failed";
  eventType?: string;
  eventId?: string;
  page?: number;
  pageSize?: number;
}

export interface QueryIncomingWebhooksParams {
  storeId?: string;
  provider?: "razorpay" | "shiprocket" | "nimbus_post" | "generic";
  status?: "pending" | "processed" | "failed";
  eventType?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function useWebhooks(params?: QueryWebhooksParams) {
  return useQuery<PaginatedResponse<Webhook>>({
    queryKey: ["webhooks", params],
    queryFn: () =>
      api.get(endpoints.webhooks.list, {
        params: params as Record<string, string | number | boolean | undefined>,
      }),
  });
}

export function useWebhook(id: string) {
  return useQuery<Webhook>({
    queryKey: ["webhooks", id],
    queryFn: () => api.get(endpoints.webhooks.detail(id)),
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, CreateWebhookDto>({
    mutationFn: (data) => api.post(endpoints.webhooks.create, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, { id: string; data: UpdateWebhookDto }>({
    mutationFn: ({ id, data }) =>
      api.patch(endpoints.webhooks.update(id), data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhooks", variables.id] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(endpoints.webhooks.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useTestWebhook() {
  return useMutation<
    { success: boolean; message: string },
    Error,
    { id: string; payload?: Record<string, unknown>; eventType?: string }
  >({
    mutationFn: ({ id, payload, eventType }) =>
      api.post(endpoints.webhooks.test(id), { payload, eventType }),
  });
}

export function useEnableWebhook() {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, string>({
    mutationFn: (id) => api.post(endpoints.webhooks.enable(id)),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhooks", id] });
    },
  });
}

export function useDisableWebhook() {
  const queryClient = useQueryClient();

  return useMutation<Webhook, Error, string>({
    mutationFn: (id) => api.post(endpoints.webhooks.disable(id)),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhooks", id] });
    },
  });
}

export function useWebhookLogs(id: string, params?: QueryWebhookLogsParams) {
  return useQuery<PaginatedResponse<WebhookLog>>({
    queryKey: ["webhooks", id, "logs", params],
    queryFn: () =>
      api.get(endpoints.webhooks.logs(id), {
        params: params as Record<string, string | number | boolean | undefined>,
      }),
    enabled: !!id,
  });
}

export function useIncomingWebhooks(params?: QueryIncomingWebhooksParams) {
  return useQuery<PaginatedResponse<IncomingWebhook>>({
    queryKey: ["webhooks", "incoming", params],
    queryFn: () =>
      api.get(endpoints.webhooks.incoming.list, {
        params: params as Record<string, string | number | boolean | undefined>,
      }),
  });
}
