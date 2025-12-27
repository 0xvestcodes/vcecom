"use client";

import { Bell, Database, Globe, Palette, Shield } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const settingsCategories = [
  {
    title: "General",
    description: "Basic application settings",
    icon: Globe,
    href: "/settings/store",
    available: true,
  },
  {
    title: "Roles & Permissions",
    description: "Manage user roles and permissions",
    icon: Shield,
    href: "/settings/roles",
    available: true,
  },
  {
    title: "Currency",
    description: "Configure currency settings",
    icon: Database,
    href: "/settings/currency",
    available: true,
  },
  {
    title: "Notifications",
    description: "Notification preferences",
    icon: Bell,
    href: "/notifications",
    available: true,
  },
  {
    title: "Appearance",
    description: "Theme and display settings",
    icon: Palette,
    href: "#",
    available: false,
  },
];

export function SettingsPageClient() {
  return (
    <AdminPageLayout
      title="Settings"
      description="Manage application settings and preferences"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsCategories.map((category) => {
            const Icon = category.icon;
            const content = (
              <Card
                className={`rounded-xl border-border/50 bg-card/50 transition-all duration-200 ${
                  category.available
                    ? "hover:border-border cursor-pointer"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{category.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    {category.description}
                  </CardDescription>
                </CardHeader>
                {!category.available && (
                  <CardContent className="p-4 pt-0">
                    <Badge variant="outline" className="text-xs">
                      Coming Soon
                    </Badge>
                  </CardContent>
                )}
              </Card>
            );

            if (category.available && category.href !== "#") {
              return (
                <Link key={category.title} href={category.href}>
                  {content}
                </Link>
              );
            }

            return <div key={category.title}>{content}</div>;
          })}
        </div>
      </div>
    </AdminPageLayout>
  );
}
