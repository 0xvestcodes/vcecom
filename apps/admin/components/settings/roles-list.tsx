"use client";

import { Eye, ShieldCheck, Tag, UserCheck } from "lucide-react";
import { QueryState } from "@/components/common/query-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminRoles } from "@/hooks/admin/use-admin-roles";

// Icon mapping for roles
const ROLE_ICONS: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  support: UserCheck,
  reviewer: Eye,
  marketing: Tag,
};

const ROLE_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  admin: "destructive",
  support: "default",
  reviewer: "secondary",
  marketing: "outline",
};

/**
 * Roles list component
 * Displays available roles and their descriptions from backend API
 */
export function RolesList() {
  const { data: roles, isLoading, error } = useAdminRoles();

  return (
    <Card className="rounded-xl border-border/50 bg-card/50">
      <CardHeader className="p-4">
        <CardTitle className="text-sm">Available Roles</CardTitle>
        <CardDescription className="text-xs">
          Roles define what features and data a user can access
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <QueryState
          isLoading={isLoading}
          error={error}
          data={roles}
          loadingComponent={
            <div className="text-xs text-muted-foreground">
              Loading roles...
            </div>
          }
          emptyComponent={
            <div className="text-center py-8 text-xs text-muted-foreground">
              No roles found
            </div>
          }
        >
          {roles && roles.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((role) => {
                const Icon = ROLE_ICONS[role.name.toLowerCase()] || ShieldCheck;
                const color = ROLE_COLORS[role.name.toLowerCase()] || "default";
                const permissionKeys = Object.keys(role.permissions || {});

                return (
                  <div
                    key={role.id}
                    className="flex items-start gap-4 rounded-xl border border-border/50 bg-card/30 p-3 transition-all duration-200"
                  >
                    <div className="rounded-full bg-muted/50 p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-xs">{role.name}</h3>
                        <Badge variant={color} className="text-xs">
                          {role.name.toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-2">
                        {permissionKeys.map((resource) => {
                          const actions = role.permissions[resource] || [];
                          return actions.map((action) => (
                            <Badge
                              key={`${resource}:${action}`}
                              variant="outline"
                              className="text-xs"
                            >
                              {resource}:{action}
                            </Badge>
                          ));
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
