"use client";

import { Eye, FileEdit, FileText, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCmsDashboard } from "@/hooks/cms/use-cms-dashboard";
import { DraftsReview } from "./drafts-review";
import { LinkHealth } from "./link-health";
import { QuickActions } from "./quick-actions";
import { RecentEdits } from "./recent-edits";

export function CmsDashboardClient() {
  const { data, isLoading, error } = useCmsDashboard();

  if (isLoading) {
    return (
      <AdminPageLayout
        title="CMS Dashboard"
        description="Overview of your content management activity"
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AdminPageLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminPageLayout
        title="CMS Dashboard"
        description="Overview of your content management activity"
      >
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load dashboard data</CardDescription>
          </CardHeader>
        </Card>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="CMS Dashboard"
      description="Overview of your content management activity"
      actions={
        <Link href="/cms/preview">
          <Button>
            <Eye className="mr-2 h-4 w-4" />
            Open Preview Mode
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Edits
              </CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.recentEditsCount}</div>
              <p className="text-xs text-muted-foreground">
                Entries and blocks edited in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.draftsCount}</div>
              <p className="text-xs text-muted-foreground">
                {data.draftsNeedingReviewCount > 0
                  ? `${data.draftsNeedingReviewCount} needing review`
                  : "All drafts up to date"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.publishedCount}</div>
              <p className="text-xs text-muted-foreground">
                Published in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Link Issues</CardTitle>
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.linkErrorsCount}</div>
              <p className="text-xs text-muted-foreground">
                {data.linkErrorsCount > 0
                  ? "Broken links found"
                  : "All links valid"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <RecentEdits entries={data.recentEdits} />
          <DraftsReview drafts={data.draftsNeedingReview} />
        </div>

        {/* Link Health */}
        <LinkHealth
          errorsCount={data.linkErrorsCount}
          warningsCount={data.linkWarningsCount}
        />
      </div>
    </AdminPageLayout>
  );
}
