"use client";

import { format } from "date-fns";
import { Plus, UserCog } from "lucide-react";
import Link from "next/link";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminCustomerGroups } from "@/hooks/customer-groups/use-admin-customer-groups";

export function CustomerGroupsPageClient() {
  const { data: groups, isLoading, error } = useAdminCustomerGroups();

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Customer Groups"
        description="Manage customer groups and assign price lists"
        actions={
          <Button asChild size="sm" className="text-xs">
            <Link href="/customer-groups/create">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Group
            </Link>
          </Button>
        }
      >
        <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Price Lists</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`customer-group-list-skeleton-row-${String(i)}`}>
                  <TableCell colSpan={6}>
                    <div className="h-10 bg-muted/30 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminPageLayout>
    );
  }

  if (error) {
    return (
      <AdminPageLayout
        title="Customer Groups"
        description="Error loading groups"
      >
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
          Error loading customer groups: {error.message}
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Customer Groups"
      description="Manage customer groups and assign price lists"
      actions={
        <Button asChild>
          <Link href="/customer-groups/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Link>
        </Button>
      }
    >
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        {!groups || groups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <UserCog className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No customer groups found</p>
            <p className="text-xs mb-4">Create your first customer group</p>
            <Button asChild size="sm" className="text-xs">
              <Link href="/customer-groups/create">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create First Group
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Price Lists</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow
                  key={group.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="font-medium text-xs">
                    <Link
                      href={`/customer-groups/${group.id}`}
                      className="hover:underline"
                    >
                      {group.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {group.description || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {group.memberCount || 0}
                  </TableCell>
                  <TableCell className="text-xs">
                    {group.priceLists && group.priceLists.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {group.priceLists.length} list
                        {group.priceLists.length !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={group.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {group.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(group.createdAt), "MMM dd, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminPageLayout>
  );
}
