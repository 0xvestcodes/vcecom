"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { useApiMutation } from "../use-api-mutation";
import { useApiQuery } from "../use-api-query";

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueInfo {
  name: string;
  stats: QueueStats;
}

export interface QueueJobInfo {
  id: string;
  name: string;
  data: unknown;
  state: string;
  progress: number | object;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
}

export interface DeadLetterJob {
  id: string;
  name: string;
  queue: string;
  data: unknown;
  failedReason: string;
  timestamp: Date;
  attemptsMade: number;
  originalJobId?: string;
}

export interface QueuesListResponse {
  queues: QueueInfo[];
}

export interface QueueJobsResponse {
  queueName: string;
  status: string;
  jobs: QueueJobInfo[];
}

export interface DeadLetterResponse {
  jobs: DeadLetterJob[];
  stats: {
    total: number;
    waiting: number;
    active: number;
  };
}

export interface QueueMetricsResponse {
  queues: number;
  totalWaiting: number;
  totalActive: number;
  totalCompleted: number;
  totalFailed: number;
  totalDelayed: number;
  deadLetterQueue: {
    total: number;
    waiting: number;
    active: number;
  };
}

export function useQueues() {
  return useApiQuery<QueuesListResponse>(endpoints.jobs.queues.list, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useQueueMetrics() {
  return useApiQuery<QueueMetricsResponse>(endpoints.jobs.queues.metrics, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useQueueStats(queueName: string) {
  return useApiQuery<QueueInfo>(endpoints.jobs.queues.detail(queueName), {
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!queueName,
  });
}

export function useQueueJobs(
  queueName: string,
  status: "waiting" | "active" | "completed" | "failed" | "delayed" = "waiting",
  start = 0,
  end = 50,
) {
  return useApiQuery<QueueJobsResponse>(
    `${endpoints.jobs.queues.jobs(queueName, status)}&start=${start}&end=${end}`,
    {
      refetchInterval: 10000, // Refresh every 10 seconds
      enabled: !!queueName,
    },
  );
}

export function useJobDetails(queueName: string, jobId: string) {
  return useApiQuery<QueueJobInfo>(
    endpoints.jobs.queues.jobDetail(queueName, jobId),
    {
      enabled: !!queueName && !!jobId,
    },
  );
}

export function useDeadLetterJobs(start = 0, end = 50) {
  return useApiQuery<DeadLetterResponse>(
    `${endpoints.jobs.deadLetter.list}?start=${start}&end=${end}`,
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  );
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string; queueName: string; jobId: string },
    { queueName: string; jobId: string }
  >({
    mutationFn: async ({ queueName, jobId }) => {
      return api.post<{ message: string; queueName: string; jobId: string }>(
        endpoints.jobs.queues.retryJob(queueName, jobId),
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.jobs.queues.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.jobs.queues.detail(data.queueName)],
      });
      toast.success(`Job ${data.jobId} retried successfully`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to retry job");
    },
  });
}

export function usePauseQueue() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string; queueName: string },
    { queueName: string }
  >({
    mutationFn: async ({ queueName }) => {
      return api.post<{ message: string; queueName: string }>(
        endpoints.jobs.queues.pause(queueName),
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.jobs.queues.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.jobs.queues.detail(data.queueName)],
      });
      toast.success(`Queue ${data.queueName} paused`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to pause queue");
    },
  });
}

export function useResumeQueue() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string; queueName: string },
    { queueName: string }
  >({
    mutationFn: async ({ queueName }) => {
      return api.post<{ message: string; queueName: string }>(
        endpoints.jobs.queues.resume(queueName),
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.jobs.queues.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.jobs.queues.detail(data.queueName)],
      });
      toast.success(`Queue ${data.queueName} resumed`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resume queue");
    },
  });
}

export function useRemoveJob() {
  const queryClient = useQueryClient();

  return useApiMutation<
    { message: string; queueName: string; jobId: string },
    { queueName: string; jobId: string }
  >({
    mutationFn: async ({ queueName, jobId }) => {
      return api.delete<{ message: string; queueName: string; jobId: string }>(
        endpoints.jobs.queues.removeJob(queueName, jobId),
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [endpoints.jobs.queues.list] });
      queryClient.invalidateQueries({
        queryKey: [endpoints.jobs.queues.detail(data.queueName)],
      });
      toast.success(`Job ${data.jobId} removed`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove job");
    },
  });
}
