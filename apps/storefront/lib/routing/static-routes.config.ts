/**
 * Static Route Configuration
 *
 * Static routes that never change - stored in TypeScript config, not database.
 * These routes are used by proxy for fast route matching.
 */

export const STATIC_ROUTES = [
  "/",
  "/products",
  "/collections",
  "/blog",
  "/cart",
  "/checkout",
  "/account",
  "/account/orders",
  "/auth/login",
  "/auth/register",
  "/search",
  "/categories",
  "/bundles",
] as const;

export type StaticRoute = (typeof STATIC_ROUTES)[number];

/**
 * Check if a pathname matches a static route
 */
export function isStaticRoute(pathname: string): boolean {
  return STATIC_ROUTES.some((route) => {
    // Exact match
    if (pathname === route) {
      return true;
    }
    // Check if pathname starts with route (for nested routes like /account/orders)
    if (pathname.startsWith(`${route}/`)) {
      return true;
    }
    return false;
  });
}
