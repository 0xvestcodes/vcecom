"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";

/**
 * Footer Navigation Editor
 * Similar to header but with column support
 */
export function FooterNavigationEditor() {
  return (
    <AdminPageLayout
      title="Footer Navigation"
      description="Manage your site's footer navigation"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Navigation", href: "/cms/navigation" },
        { label: "Footer" },
      ]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/cms/navigation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Footer navigation editor coming soon
        </p>
      </div>
    </AdminPageLayout>
  );
}
