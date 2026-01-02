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
 * Page Create Client
 * Create a new CMS page
 */
export function PageCreateClient() {
  const router = useRouter();
  const { data: contentTypes } = useAdminContentTypes();
  const pageContentType = contentTypes?.find(
    (ct) => ct.name === "page" || ct.displayName.toLowerCase() === "page",
  );
  const contentTypeId = pageContentType?.id || "";

  const [title, setTitle] = useState("");
  const createMutation = useAdminCreateEntry(contentTypeId);

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Please enter a page title");
      return;
    }

    createMutation.mutate(
      {
        data: {
          title,
          blocks: [],
        },
        status: "draft",
      },
      {
        onSuccess: (entry) => {
          router.push(`/cms/pages/${entry.id}/edit`);
        },
      },
    );
  };

  if (!contentTypeId && contentTypes) {
    return (
      <AdminPageLayout
        title="Create Page"
        description="Create a new CMS page"
        breadcrumbs={[
          { label: "CMS", href: "/cms/dashboard" },
          { label: "Pages", href: "/cms/pages" },
          { label: "Create" },
        ]}
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Page content type not found. Please create a "page" content type
            first.
          </p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Create Page"
      description="Create a new CMS page"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Pages", href: "/cms/pages" },
        { label: "Create" },
      ]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/cms/pages">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Page Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter page title"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/cms/pages">Cancel</Link>
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Page"}
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
