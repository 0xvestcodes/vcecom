import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

/**
 * Hook for submitting entry for review
 */
export function useAdminSubmitForReview(
  entryId: string,
  contentTypeId: string,
) {
  const queryClient = useQueryClient();

  return useApiMutation<void, void>({
    mutationFn: async () => {
      await api.post(endpoints.cms.entries.submitForReview(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms", "entries", entryId] });
      queryClient.invalidateQueries({
        queryKey: ["cms", "entries", contentTypeId],
      });
      toast.success("Entry moved to review");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to move to review");
    },
  });
}

/**
 * Hook for approving and publishing entry
 */
export function useAdminApproveAndPublish(
  entryId: string,
  contentTypeId: string,
) {
  const queryClient = useQueryClient();

  return useApiMutation<void, void>({
    mutationFn: async () => {
      await api.post(endpoints.cms.entries.approve(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms", "entries", entryId] });
      queryClient.invalidateQueries({
        queryKey: ["cms", "entries", contentTypeId],
      });
      toast.success("Entry approved and published");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to approve and publish");
    },
  });
}

/**
 * Hook for rejecting entry review
 */
export function useAdminRejectReview(entryId: string, contentTypeId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<void, void>({
    mutationFn: async () => {
      await api.post(endpoints.cms.entries.reject(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms", "entries", entryId] });
      queryClient.invalidateQueries({
        queryKey: ["cms", "entries", contentTypeId],
      });
      toast.success("Entry sent back to draft");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to send back");
    },
  });
}

/**
 * Hook for checking entry lock status
 */
export function useAdminEntryLock(entryId: string) {
  return useApiQuery<{
    locked: boolean;
    lockedBy?: string;
    lockType?: "hard" | "soft";
    expiresAt?: string;
  }>(endpoints.cms.entries.checkLock(entryId), {
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!entryId,
  });
}

/**
 * Hook for acquiring entry lock
 */
export function useAdminAcquireLock(entryId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<void, void>({
    mutationFn: async () => {
      await api.post(endpoints.cms.entries.acquireLock(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cms", "entries", entryId, "lock"],
      });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to acquire lock");
    },
  });
}

/**
 * Hook for releasing entry lock
 */
export function useAdminReleaseLock(entryId: string) {
  const queryClient = useQueryClient();

  return useApiMutation<void, void>({
    mutationFn: async () => {
      await api.delete(endpoints.cms.entries.releaseLock(entryId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cms", "entries", entryId, "lock"],
      });
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to release lock");
    },
  });
}

/**
 * Hook for checking publish readiness
 */
export function useAdminPublishReadiness(entryId: string) {
  return useApiQuery<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>(endpoints.cms.entries.publishReadiness(entryId), {
    enabled: !!entryId,
  });
}

/**
 * Hook for listing entry snapshots
 */
export function useAdminEntrySnapshots(
  entryId: string,
  type?: "draft" | "review" | "published",
) {
  const url = `${endpoints.cms.entries.snapshots(entryId)}${type ? `?type=${type}` : ""}`;
  return useApiQuery<{
    draft?: unknown;
    review?: unknown;
    published?: unknown[];
  }>(url, {
    enabled: !!entryId,
  });
}
