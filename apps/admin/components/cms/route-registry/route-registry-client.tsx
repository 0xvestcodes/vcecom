"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Plus } from "lucide-react";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/use-api-query";
import { endpoints } from "@/lib/endpoints";

interface RouteRegistryItem {
  id: string;
  slug: string;
  pattern: string;
  entityType: "product" | "collection" | "cms_page";
  entityId: string;
  redirectTo?: string | null;
  isFallback: boolean;
  locale?: string | null;
  updatedAt: Date;
}

/**
 * Route Registry client component
 * Shows all registered routes with conflicts and redirects
 */
export function RouteRegistryClient() {
  const { data, isLoading, error } = useApiQuery<RouteRegistryItem[]>(
    endpoints.cms.routeRegistry?.list || "/admin/cms/route-registry",
    {
      enabled: true,
    },
  );

  const getTypeBadge = (pattern: string) => {
    if (pattern.includes("[slug]") || pattern.includes("[id]")) {
      return <Badge variant="secondary">Dynamic</Badge>;
    }
    return <Badge variant="outline">Static</Badge>;
  };

  const getEntityTypeBadge = (entityType: string) => {
    switch (entityType) {
      case "product":
        return <Badge variant="default">Product</Badge>;
      case "collection":
        return <Badge variant="default">Collection</Badge>;
      case "cms_page":
        return <Badge variant="default">CMS Page</Badge>;
      default:
        return <Badge>{entityType}</Badge>;
    }
  };

  const conflicts =
    data?.filter((route, index, arr) =>
      arr.some(
        (r, i) => i !== index && r.pattern === route.pattern && !r.isFallback,
      ),
    ) || [];

  return (
    <AdminPageLayout
      title="Route Registry"
      description="Manage all application routes and redirects"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Route Registry" },
      ]}
      actions={
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Register Route
        </Button>
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        isEmpty={(d) => Array.isArray(d) && d.length === 0}
        emptyComponent={
          <div className="text-center py-8 text-muted-foreground">
            No routes registered
          </div>
        }
      >
        {conflicts.length > 0 && (
          <div className="mb-4 p-4 border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-sm">
                  {conflicts.length} route conflict(s) found
                </p>
                <p className="text-xs text-muted-foreground">
                  Multiple routes claim the same pattern
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Redirect</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((route) => (
                <TableRow key={route.id}>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {route.slug}
                    </code>
                    {route.isFallback && (
                      <Badge variant="outline" className="ml-2">
                        Fallback
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {route.pattern}
                    </code>
                  </TableCell>
                  <TableCell>{getTypeBadge(route.pattern)}</TableCell>
                  <TableCell>
                    {getEntityTypeBadge(route.entityType)}
                    <span className="block text-xs mt-1 font-mono text-muted-foreground">
                      {route.entityId.slice(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell>
                    {route.redirectTo ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        → {route.redirectTo}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(route.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>
    </AdminPageLayout>
  );
}
