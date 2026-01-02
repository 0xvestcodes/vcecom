/**
 * Route Pattern Matching Utilities
 *
 * Re-exported from backend config for storefront use
 */

export interface RoutePatternConfig {
  resolver: string;
  entityType: "product" | "collection" | "cms_page";
  fallback?: boolean;
}

export const ROUTE_PATTERNS: Record<string, RoutePatternConfig> = {
  "/products/[slug]": {
    resolver: "product_by_slug",
    entityType: "product",
  },
  "/products/[id]": {
    resolver: "product_by_id",
    entityType: "product",
    fallback: true,
  },
  "/collections/[slug]": {
    resolver: "collection_by_slug",
    entityType: "collection",
  },
  "/collections/[id]": {
    resolver: "collection_by_id",
    entityType: "collection",
    fallback: true,
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
 * Match a pathname against route patterns
 * More specific patterns are checked first (longer patterns before shorter ones)
 */
export function matchRoutePattern(
  pathname: string,
): { pattern: string; params: Record<string, string> } | null {
  // Sort patterns by specificity (longer patterns first) to ensure more specific matches
  const sortedPatterns = Object.entries(ROUTE_PATTERNS).sort((a, b) => {
    const aLength = a[0].split("/").length;
    const bLength = b[0].split("/").length;
    return bLength - aLength; // Longer patterns first
  });

  for (const [pattern, _config] of sortedPatterns) {
    const regex = patternToRegex(pattern);
    const match = pathname.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      const paramNames = pattern.match(/\[(\w+)\]/g) || [];
      paramNames.forEach((param, index) => {
        const paramName = param.slice(1, -1);
        params[paramName] = match[index + 1] || "";
      });
      return { pattern, params };
    }
  }
  return null;
}

/**
 * Convert route pattern to regex
 */
function patternToRegex(pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/\//g, "\\/")
    .replace(/\[(\w+)\]/g, "([^/]+)");
  return new RegExp(`^${regexPattern}$`);
}
