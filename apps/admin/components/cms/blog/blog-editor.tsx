"use client";

import { ArrowLeft, Eye, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminEntry } from "@/hooks/cms/use-admin-entries";
import { BlogContentPane } from "./blog-content-pane";
import { BlogMetaPane } from "./blog-meta-pane";

interface BlogEditorProps {
  postId: string;
}

/**
 * Blog Editor - Simplified 2-pane editor
 * Left: Content editor, Right: Meta/SEO
 */
export function BlogEditor({ postId }: BlogEditorProps) {
  const _router = useRouter();
  const { data: entry, isLoading } = useAdminEntry(postId);

  if (isLoading) {
    return (
      <AdminPageLayout title="Edit Blog Post" description="Edit your blog post">
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminPageLayout>
    );
  }

  if (!entry) {
    return (
      <AdminPageLayout
        title="Post Not Found"
        description="The post you're looking for doesn't exist"
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">Post not found</p>
          <Button asChild className="mt-4">
            <Link href="/cms/blog">Back to Blog</Link>
          </Button>
        </div>
      </AdminPageLayout>
    );
  }

  const postTitle = (entry.data.title as string) || "Untitled Post";

  return (
    <AdminPageLayout
      title={`Edit: ${postTitle}`}
      description="Edit your blog post"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Blog", href: "/cms/blog" },
        { label: postTitle },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Left Pane: Content Editor */}
        <div className="col-span-8">
          <BlogContentPane entry={entry} />
        </div>

        {/* Right Pane: Meta/SEO */}
        <div className="col-span-4 border-l pl-4">
          <BlogMetaPane entry={entry} />
        </div>
      </div>
    </AdminPageLayout>
  );
}
