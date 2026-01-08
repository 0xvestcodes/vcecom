/**
 * Route-to-Role Mapping Configuration
 * Centralized mapping of routes to required roles for access control
 */

import type { AdminRole } from "./navigation";

/**
 * Route permissions mapping
 * Maps route paths to required roles for access
 */
const routePermissions: Record<string, AdminRole[]> = {
  // Dashboard - accessible to all admin roles
  "/": ["admin", "support", "reviewer", "marketing"],
  "/dashboards/performance": ["admin", "support", "reviewer", "marketing"],
  "/dashboards/operations": ["admin", "support", "reviewer", "marketing"],
  "/dashboards/customer-support": ["admin", "support", "reviewer", "marketing"],
  "/dashboards/product-merchandising": [
    "admin",
    "support",
    "reviewer",
    "marketing",
  ],

  // Orders - admin and support
  "/orders": ["admin", "support"],
  "/orders/abandoned": ["admin", "support"],

  // Products - admin and marketing
  "/products": ["admin", "marketing"],
  "/products/create": ["admin", "marketing"],
  "/products/categories": ["admin", "marketing"],
  "/products/collections": ["admin", "marketing"],
  "/bundles": ["admin", "marketing"],

  // Inventory - admin only
  "/inventory": ["admin"],
  "/inventory/settings": ["admin"],
  "/inventory/bulk-adjust": ["admin"],

  // Reviews - admin and reviewer
  "/reviews": ["admin", "reviewer"],

  // Customers - admin and support
  "/customers": ["admin", "support"],

  // Customer Groups - admin and marketing
  "/customer-groups": ["admin", "marketing"],

  // Marketing - admin and marketing
  "/discounts": ["admin", "marketing"],
  "/price-lists": ["admin", "marketing"],

  // CMS / Content - multiple roles
  "/cms/media": ["admin", "support", "reviewer", "marketing"],

  // Settings - admin only
  "/settings": ["admin"],
  "/settings/store": ["admin"],
  "/settings/currency": ["admin"],
  "/settings/shipping-methods": ["admin"],
  "/settings/payment-fees": ["admin"],
  "/settings/roles": ["admin"],
  "/settings/system-logs": ["admin"],

  // System - admin only
  "/storage": ["admin"],
  "/notifications": ["admin"],
  "/activity-logs": ["admin"],
  "/audit-logs": ["admin"],

  // User pages - accessible to all authenticated users
  "/profile": ["admin", "support", "reviewer", "marketing"],
  "/support": ["admin", "support", "reviewer", "marketing"],
};

/**
 * Get required roles for a specific route
 * @param pathname - The route pathname (e.g., "/products", "/orders/123")
 * @returns Array of required roles, or null if route has no restrictions
 */
export function getRequiredRolesForRoute(pathname: string): AdminRole[] | null {
  // Normalize pathname - remove trailing slash (except root)
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  // Check exact match first
  if (routePermissions[normalizedPath]) {
    return routePermissions[normalizedPath];
  }

  // Check for dynamic routes (e.g., /products/:id)
  // Match the base path before any dynamic segments
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  // Try to match by base path segments
  for (const [route, roles] of Object.entries(routePermissions)) {
    const routeSegments = route.split("/").filter(Boolean);

    // If the path starts with the route segments, it's a match
    if (
      routeSegments.length > 0 &&
      pathSegments.length >= routeSegments.length &&
      routeSegments.every((segment, index) => segment === pathSegments[index])
    ) {
      return roles;
    }
  }

  // No restrictions found - allow access (backward compatibility)
  return null;
}

/**
 * Check if a route requires specific roles
 * @param pathname - The route pathname
 * @returns true if route has role restrictions, false otherwise
 */
export function routeRequiresRoles(pathname: string): boolean {
  return getRequiredRolesForRoute(pathname) !== null;
}
