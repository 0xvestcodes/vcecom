"use client";

import { ArrowRight, Navigation } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Navigation list client
 * Shows available navigation sets (Header, Footer, Custom)
 */
export function NavigationListClient() {
  return (
    <AdminPageLayout
      title="Navigation"
      description="Manage site navigation menus"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Navigation" },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/cms/navigation/header">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Header Navigation
              </CardTitle>
              <CardDescription>
                Manage main site navigation menu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between">
                Edit
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cms/navigation/footer">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Footer Navigation
              </CardTitle>
              <CardDescription>Manage footer links and columns</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between">
                Edit
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </AdminPageLayout>
  );
}
