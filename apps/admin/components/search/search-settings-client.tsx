"use client";

import { Database, RefreshCw, Settings } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReindexCard } from "./reindex-card";
import { RelevanceConfigCard } from "./relevance-config-card";
import { SearchStatusCard } from "./search-status-card";

/**
 * Search Settings Page Client Component
 * Main component for managing search infrastructure
 */
export function SearchSettingsClient() {
  return (
    <AdminPageLayout
      title="Search Settings"
      description="Manage search indexes, reindexing, and relevance tuning"
    >
      <Tabs defaultValue="status" className="space-y-6">
        <TabsList>
          <TabsTrigger value="status" className="gap-2">
            <Database className="h-4 w-4" />
            Status
          </TabsTrigger>
          <TabsTrigger value="reindex" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reindex
          </TabsTrigger>
          <TabsTrigger value="relevance" className="gap-2">
            <Settings className="h-4 w-4" />
            Relevance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <SearchStatusCard />
        </TabsContent>

        <TabsContent value="reindex" className="space-y-6">
          <ReindexCard />
        </TabsContent>

        <TabsContent value="relevance" className="space-y-6">
          <RelevanceConfigCard />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
}
