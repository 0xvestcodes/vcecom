/**
 * Route Pattern Configuration
 *
 * Manual registration of dynamic route patterns.
 * Developers explicitly register patterns - no auto-detection.
 */

export interface RoutePatternConfig {
  resolver: string;
  entityType: "product" | "collection" | "cms_page";
  fallback?: boolean; // Use if primary resolution fails
}

export const ROUTE_PATTERNS: Record<string, RoutePatternConfig> = {
  "/products/[slug]": {
    resolver: "product_by_slug",
    entityType: "product",
  },
  "/products/[id]": {
    resolver: "product_by_id",
    entityType: "product",
    fallback: true, // Use if slug resolution fails
  },
  "/collections/[slug]": {
    resolver: "collection_by_slug",
    entityType: "collection",
  },
  "/collections/[id]": {
    resolver: "collection_by_id",
    entityType: "collection",
    fallback: true, // Use if slug resolution fails
  },
  "/cms/[contentType]/[slug]": {
    resolver: "cms_by_slug",
    entityType: "cms_page",
  },
  "/blog/[slug]": {
    resolver: "cms_by_slug",
    entityType: "cms_page",
  },
  "/pages/[slug]": {
    resolver: "cms_by_slug",
    entityType: "cms_page",
  },
  "/[slug]": {
    resolver: "cms_by_slug",
    entityType: "cms_page",
  },
} as const;

/**
 * Get route pattern config for a given pattern
 */
export function getRoutePattern(
  pattern: string,
): RoutePatternConfig | undefined {
  return ROUTE_PATTERNS[pattern];
}

/**
 * Match a pathname against route patterns
 * Returns the matched pattern and extracted params
 */
export function matchRoutePattern(
  pathname: string,
): { pattern: string; params: Record<string, string> } | null {
  for (const [pattern, _config] of Object.entries(ROUTE_PATTERNS)) {
    const regex = patternToRegex(pattern);
    const match = pathname.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      const paramNames = pattern.match(/\[(\w+)\]/g) || [];
      paramNames.forEach((param, index) => {
        const paramName = param.slice(1, -1); // Remove [ and ]
        params[paramName] = match[index + 1] || "";
      });
      return { pattern, params };
    }
  }
  return null;
}

/**
 * Convert route pattern to regex
 * e.g., "/products/[slug]" -> "^/products/([^/]+)$"
 */
function patternToRegex(pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/\//g, "\\/")
    .replace(/\[(\w+)\]/g, "([^/]+)");
  return new RegExp(`^${regexPattern}$`);
}
