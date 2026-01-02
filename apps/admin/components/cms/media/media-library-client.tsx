"use client";

import { Image as ImageIcon, Upload } from "lucide-react";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Media Library Client
 * Grid view of media files with upload
 */
export function MediaLibraryClient() {
  const [search, setSearch] = useState("");

  return (
    <AdminPageLayout
      title="Media Library"
      description="Manage your media files"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Media" },
      ]}
      actions={
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Media
        </Button>
      }
      filters={
        <Input
          placeholder="Search media..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {/* Placeholder for media items */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card
            key={i}
            className="aspect-square cursor-pointer hover:bg-accent transition-colors"
          >
            <CardContent className="flex items-center justify-center h-full p-2">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPageLayout>
  );
}
