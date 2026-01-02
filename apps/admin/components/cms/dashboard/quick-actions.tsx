"use client";

import { FilePlus, Image, Navigation } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";

export function QuickActions() {
  const { data: contentTypes } = useAdminContentTypes();

  // Find common content types for quick actions
  const pageContentType = contentTypes?.find(
    (ct) => ct.name === "page" || ct.displayName.toLowerCase() === "page",
  );
  const blogContentType = contentTypes?.find(
    (ct) =>
      ct.name === "blog_post" ||
      ct.name === "blog" ||
      ct.displayName.toLowerCase().includes("blog"),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common CMS tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {pageContentType && (
            <Link
              href={`/cms/content-types/${pageContentType.id}/entries/create`}
            >
              <Button variant="outline" className="w-full justify-start">
                <FilePlus className="mr-2 h-4 w-4" />
                Create Page
              </Button>
            </Link>
          )}

          {blogContentType && (
            <Link
              href={`/cms/content-types/${blogContentType.id}/entries/create`}
            >
              <Button variant="outline" className="w-full justify-start">
                <FilePlus className="mr-2 h-4 w-4" />
                Create Blog Post
              </Button>
            </Link>
          )}

          <Link href="/cms/media">
            <Button variant="outline" className="w-full justify-start">
              <Image className="mr-2 h-4 w-4" />
              Upload Media
            </Button>
          </Link>

          <Link href="/cms/navigation">
            <Button variant="outline" className="w-full justify-start">
              <Navigation className="mr-2 h-4 w-4" />
              Manage Navigation
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
