"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * SEO Overview Client
 * Shows SEO status for all pages
 */
export function SeoOverviewClient() {
  // TODO: Fetch SEO data from API
  const seoData: Array<{
    page: string;
    seoTitle: string;
    seoDescription: string;
    hasOgImage: boolean;
    indexable: boolean;
    linkIssues: number;
  }> = [];

  const getSeoTitleStatus = (title: string) => {
    if (!title) return { status: "error", label: "Missing" };
    if (title.length < 30) return { status: "warning", label: "Too short" };
    if (title.length > 60) return { status: "warning", label: "Too long" };
    return { status: "ok", label: "Good" };
  };

  const getSeoDescriptionStatus = (desc: string) => {
    if (!desc) return { status: "error", label: "Missing" };
    if (desc.length < 120) return { status: "warning", label: "Too short" };
    if (desc.length > 160) return { status: "warning", label: "Too long" };
    return { status: "ok", label: "Good" };
  };

  return (
    <AdminPageLayout
      title="SEO Tools"
      description="Overview of SEO status across all pages"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "SEO Tools" },
      ]}
    >
      {seoData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No SEO data available. Create some pages first.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>SEO Title</TableHead>
                <TableHead>Meta Description</TableHead>
                <TableHead>OG Image</TableHead>
                <TableHead>Index</TableHead>
                <TableHead>Link Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seoData.map((item, index) => {
                const titleStatus = getSeoTitleStatus(item.seoTitle);
                const descStatus = getSeoDescriptionStatus(item.seoDescription);

                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Table row, index is stable
                  <TableRow key={`item-${index}`}>
                    <TableCell className="font-medium">{item.page}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.seoTitle.length}/60
                        </span>
                        {titleStatus.status === "ok" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.seoDescription.length}/160
                        </span>
                        {descStatus.status === "ok" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.hasOgImage ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.indexable ? "default" : "outline"}>
                        {item.indexable ? "Index" : "No-index"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.linkIssues > 0 ? (
                        <Badge variant="destructive">{item.linkIssues}</Badge>
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminPageLayout>
  );
}
