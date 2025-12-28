import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminRole {
  id: string;
  name: string;
  permissions: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin-roles"],
    queryFn: async (): Promise<AdminRole[]> => {
      return api.get<AdminRole[]>(`/admin/permissions/roles`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
