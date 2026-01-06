"use client";

import { AlertCircle, CheckCircle2, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchStats } from "@/hooks/search/use-search-stats";

/**
 * Search Status Card Component
 * Displays search index statistics and health
 */
export function SearchStatusCard() {
  const { data, isLoading, error } = useSearchStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Index Status</CardTitle>
          <CardDescription>Loading search statistics...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load search statistics: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          No search statistics available. Make sure search is configured.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Search Provider</CardTitle>
            </div>
            <Badge variant="secondary" className="uppercase">
              {data.provider || "database"}
            </Badge>
          </div>
          <CardDescription>
            Current search engine provider and index status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.indexes && data.indexes.length > 0 ? (
            <div className="space-y-4">
              {data.indexes.map((index) => (
                <div
                  key={index.indexName}
                  className="rounded-lg border border-border/50 bg-card/50 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm capitalize">
                      {index.indexName}
                    </h4>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Documents</p>
                      <p className="text-lg font-semibold">
                        {index.totalDocuments.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Size</p>
                      <p className="text-lg font-semibold">
                        {index.indexSizeMb.toFixed(2)} MB
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last Updated
                      </p>
                      <p className="text-sm font-medium">
                        {index.lastUpdate
                          ? new Date(index.lastUpdate).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Indexes</AlertTitle>
              <AlertDescription>
                No search indexes found. Trigger a reindex to create indexes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
