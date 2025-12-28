"use client";

import { Check, X } from "lucide-react";
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

/**
 * Permission categories and actions
 */
const PERMISSIONS = [
  {
    category: "Products",
    actions: [
      { id: "products:read", name: "View Products" },
      { id: "products:create", name: "Create Products" },
      { id: "products:update", name: "Update Products" },
      { id: "products:delete", name: "Delete Products" },
      { id: "products:bulk", name: "Bulk Operations" },
    ],
  },
  {
    category: "Orders",
    actions: [
      { id: "orders:read", name: "View Orders" },
      { id: "orders:update", name: "Update Orders" },
      { id: "orders:refund", name: "Process Refunds" },
      { id: "orders:mark-paid", name: "Mark as Paid" },
      { id: "orders:notes", name: "Add Notes" },
    ],
  },
  {
    category: "Inventory",
    actions: [
      { id: "inventory:read", name: "View Inventory" },
      { id: "inventory:adjust", name: "Adjust Inventory" },
      { id: "inventory:bulk-adjust", name: "Bulk Adjust" },
      { id: "inventory:settings", name: "Manage Settings" },
    ],
  },
  {
    category: "Discounts",
    actions: [
      { id: "discounts:read", name: "View Discounts" },
      { id: "discounts:create", name: "Create Discounts" },
      { id: "discounts:update", name: "Update Discounts" },
      { id: "discounts:delete", name: "Delete Discounts" },
    ],
  },
  {
    category: "Price Lists",
    actions: [
      { id: "price-lists:read", name: "View Price Lists" },
      { id: "price-lists:create", name: "Create Price Lists" },
      { id: "price-lists:update", name: "Update Price Lists" },
      { id: "price-lists:delete", name: "Delete Price Lists" },
    ],
  },
  {
    category: "Customers",
    actions: [
      { id: "customers:read", name: "View Customers" },
      { id: "customers:update", name: "Update Customers" },
    ],
  },
  {
    category: "Reviews",
    actions: [
      { id: "reviews:read", name: "View Reviews" },
      { id: "reviews:approve", name: "Approve Reviews" },
      { id: "reviews:reject", name: "Reject Reviews" },
      { id: "reviews:delete", name: "Delete Reviews" },
    ],
  },
  {
    category: "Media & Storage",
    actions: [
      { id: "storage:read", name: "View Files" },
      { id: "storage:upload", name: "Upload Files" },
      { id: "storage:delete", name: "Delete Files" },
    ],
  },
] as const;

// Helper function to convert role permissions to flat array
function getRolePermissionsFlat(
  permissions: Record<string, string[]>,
): string[] {
  return Object.entries(permissions).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`),
  );
}

/**
 * Permissions matrix component
 * Shows which permissions each role has from backend API
 */
export function PermissionsMatrix() {
  const { data: roles, isLoading, error } = useAdminRoles();

  // Build role permissions map from API data
  const rolePermissionsMap = roles
    ? Object.fromEntries(
        roles.map((role) => [
          role.name.toLowerCase(),
          getRolePermissionsFlat(role.permissions),
        ]),
      )
    : {};

  const rolesList = roles
    ? roles.map((r) => r.name.toLowerCase())
    : ["admin", "support", "reviewer", "marketing"];

  return (
    <Card className="rounded-xl border-border/50 bg-card/50">
      <CardHeader className="p-4">
        <CardTitle className="text-sm">Permissions Matrix</CardTitle>
        <CardDescription className="text-xs">
          View which permissions are available for each role
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <QueryState
          isLoading={isLoading}
          error={error as never}
          data={roles}
          loadingComponent={
            <div className="text-xs text-muted-foreground">
              Loading permissions...
            </div>
          }
          emptyComponent={
            <div className="text-center py-8 text-xs text-muted-foreground">
              No roles found
            </div>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-2 font-semibold text-xs">
                    Permission
                  </th>
                  {rolesList.map((role) => (
                    <th
                      key={role}
                      className="text-center p-2 font-semibold min-w-[100px] text-xs"
                    >
                      <Badge variant="outline" className="capitalize text-xs">
                        {role}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((permission) => (
                  <tr
                    key={permission.category}
                    className="border-b border-border/50"
                  >
                    <td
                      colSpan={rolesList.length + 1}
                      className="p-2 font-semibold bg-muted/30 text-xs"
                    >
                      {permission.category}
                    </td>
                  </tr>
                ))}
                {PERMISSIONS.flatMap((permission) =>
                  permission.actions.map((action) => (
                    <tr
                      key={action.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-2 pl-6 text-xs">{action.name}</td>
                      {rolesList.map((role) => {
                        const hasPermission = rolePermissionsMap[
                          role
                        ]?.includes(action.id);
                        return (
                          <td key={role} className="p-2 text-center">
                            {hasPermission ? (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}
