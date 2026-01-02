"use client";

import { Palette, Settings } from "lucide-react";
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
import { useActivateTheme, useThemes } from "@/hooks/cms/use-theme-settings";
import type { Theme } from "@/lib/types/themes";

/**
 * Themes list client component
 * Shows available themes with preview and customize options
 */
export function ThemesListClient() {
  const { data: themes, isLoading } = useThemes();
  const activateTheme = useActivateTheme();

  const handleActivate = (themeId: string) => {
    if (confirm(`Activate ${themeId} theme?`)) {
      activateTheme.mutate(themeId);
    }
  };

  return (
    <AdminPageLayout
      title="Themes"
      description="Manage your storefront themes"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Themes" },
      ]}
    >
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading themes...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(themes as Theme[])?.map((theme) => (
            <Card key={theme.id}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="h-5 w-5" />
                  <CardTitle>{theme.name}</CardTitle>
                </div>
                <CardDescription>
                  {theme.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <Link href={`/cms/themes/${theme.id}/customize`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Customize
                      </Link>
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleActivate(theme.id)}
                      disabled={activateTheme.isPending}
                    >
                      Activate
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Version {theme.version}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminPageLayout>
  );
}
