"use client";

import { Mail, Shield, User } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminSession } from "@/providers/session-provider";

function getInitials(email: string): string {
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export function ProfilePageClient() {
  const { session } = useAdminSession();

  if (!session) {
    return (
      <AdminPageLayout title="Profile" description="User profile information">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Unable to load profile information</p>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Profile"
      description="Your account information and details"
    >
      <div className="space-y-6 max-w-3xl">
        {/* Profile Header */}
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Profile Information</CardTitle>
            <CardDescription className="text-xs">
              Your account details and role
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {getInitials(session.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold">
                    {session.email.split("@")[0]}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {session.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{session.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Account Details</CardTitle>
            <CardDescription className="text-xs">
              Detailed account information
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">Email</div>
                <div className="text-xs font-medium">{session.email}</div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">Role</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {session.role}
                  </Badge>
                </div>
              </div>
            </div>

            {session.id && (
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">
                    User ID
                  </div>
                  <div className="text-xs font-mono font-medium">
                    {session.id}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageLayout>
  );
}
