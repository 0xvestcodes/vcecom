"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminContentTypes } from "@/hooks/cms/use-admin-content-types";
import { useAdminCreateEntry } from "@/hooks/cms/use-admin-create-entry";

/**
 * Blog Create Client
 * Create a new blog post
 */
export function BlogCreateClient() {
  const router = useRouter();
  const { data: contentTypes } = useAdminContentTypes();
  const blogContentType = contentTypes?.find(
    (ct) =>
      ct.name === "blog_post" ||
      ct.name === "blog" ||
      ct.displayName.toLowerCase().includes("blog"),
  );
  const contentTypeId = blogContentType?.id || "";

  const [title, setTitle] = useState("");
  const createMutation = useAdminCreateEntry(contentTypeId);

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Please enter a post title");
      return;
    }

    createMutation.mutate(
      {
        data: {
          title,
        },
        status: "draft",
      },
      {
        onSuccess: (entry) => {
          router.push(`/cms/blog/${entry.id}/edit`);
        },
      },
    );
  };

  if (!contentTypeId && contentTypes) {
    return (
      <AdminPageLayout
        title="Create Blog Post"
        description="Create a new blog post"
        breadcrumbs={[
          { label: "CMS", href: "/cms/dashboard" },
          { label: "Blog", href: "/cms/blog" },
          { label: "Create" },
        ]}
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Blog content type not found. Please create a "blog_post" content
            type first.
          </p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Create Blog Post"
      description="Create a new blog post"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Blog", href: "/cms/blog" },
        { label: "Create" },
      ]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/cms/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Post Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter post title"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/cms/blog">Cancel</Link>
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Post"}
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
