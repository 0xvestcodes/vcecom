"use client";

import { useMemo } from "react";
import type { AdminRole } from "@/lib/navigation";
import { useAdminSession } from "@/providers/session-provider";

/**
 * Check if user has a specific role or any of the provided roles
 * @param role - Single role or array of roles to check
 * @returns true if user has the role, false otherwise
 */
export function useHasRole(role: AdminRole | AdminRole[]): boolean {
  const { session } = useAdminSession();

  return useMemo(() => {
    if (!session) return false;

    // Legacy admin role has all permissions
    if (session.role === "admin") return true;

    const rolesToCheck = Array.isArray(role) ? role : [role];
    return rolesToCheck.includes(session.role);
  }, [session, role]);
}

/**
 * Check if user can access a resource that requires specific roles
 * @param requiredRoles - Array of roles that can access the resource
 * @returns true if user has one of the required roles, false otherwise
 */
export function useCanAccess(requiredRoles: AdminRole[]): boolean {
  const { session } = useAdminSession();

  return useMemo(() => {
    if (!session) return false;

    // Legacy admin role has all permissions
    if (session.role === "admin") return true;

    return requiredRoles.includes(session.role);
  }, [session, requiredRoles]);
}

/**
 * Require a specific role - throws error or redirects if user lacks role
 * This is a hook that can be used in components to enforce role requirements
 * @param role - Single role or array of roles required
 * @param redirectTo - Optional redirect path if user lacks role (default: "/403")
 */
export function useRequireRole(
  role: AdminRole | AdminRole[],
  redirectTo = "/403",
): void {
  const hasRole = useHasRole(role);

  useMemo(() => {
    if (!hasRole && typeof window !== "undefined") {
      // Redirect to forbidden page
      window.location.href = redirectTo;
    }
  }, [hasRole, redirectTo]);
}
