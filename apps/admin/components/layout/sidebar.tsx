"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHasRole } from "@/hooks/admin/use-permissions";
import { useNavState } from "@/hooks/use-nav-state";
import type { NavItem, NavSection } from "@/lib/navigation";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./admin-shell";
import { SidebarSection } from "./sidebar-section";

interface SidebarProps {
  className?: string;
}

// Component to filter navigation items based on roles
function FilteredNavigation() {
  // Check all possible roles upfront
  const hasAdmin = useHasRole("admin");
  const hasSupport = useHasRole("support");
  const hasReviewer = useHasRole("reviewer");
  const hasMarketing = useHasRole("marketing");

  // Helper function to check if user can access a nav item
  const canAccessNavItem = useMemo(() => {
    return (item: NavItem): boolean => {
      // If no required roles, allow access
      if (!item.requiredRoles || item.requiredRoles.length === 0) {
        return true;
      }

      // Check if user has any of the required roles
      return item.requiredRoles.some((role) => {
        switch (role) {
          case "admin":
            return hasAdmin;
          case "support":
            return hasSupport;
          case "reviewer":
            return hasReviewer;
          case "marketing":
            return hasMarketing;
          default:
            return false;
        }
      });
    };
  }, [hasAdmin, hasSupport, hasReviewer, hasMarketing]);

  // Filter navigation based on user roles
  const filteredNavigation = useMemo(() => {
    return navigation
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            // Filter children if they exist
            const filteredChildren = item.children
              ? item.children.filter((child) => canAccessNavItem(child))
              : undefined;

            // If item has children, show parent if any child is accessible
            if (
              item.children &&
              filteredChildren &&
              filteredChildren.length > 0
            ) {
              return {
                ...item,
                children: filteredChildren,
              };
            }

            // If item has no children or all children filtered out, check parent access
            if (canAccessNavItem(item)) {
              return item;
            }

            return null;
          })
          .filter((item): item is NavItem => item !== null);

        // Only include section if it has items
        if (filteredItems.length === 0) {
          return null;
        }

        return {
          ...section,
          items: filteredItems,
        };
      })
      .filter((section): section is NavSection => section !== null);
  }, [canAccessNavItem]);

  return (
    <>
      {filteredNavigation.map((section, sectionIndex) => (
        <div key={`nav-section-${String(sectionIndex)}`} className="space-y-1">
          {section.label && (
            <div className="px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {section.label}
              </span>
            </div>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <SidebarSection key={item.href} item={item} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed } = useNavState();
  const sidebar = useSidebar();
  const isMobileOpen = sidebar?.isMobileOpen ?? false;
  const setIsMobileOpen = sidebar?.setIsMobileOpen ?? (() => {});

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r border-border/50 bg-sidebar transition-all duration-300 lg:static lg:z-auto",
          "w-64", // Always full width on mobile, collapsed state only applies on desktop
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed && "lg:w-16", // Only apply collapsed width on desktop
          !isCollapsed && "lg:w-64", // Full width on desktop when not collapsed
          className,
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
            {!isCollapsed && (
              <Link href="/" className="text-sm font-semibold tracking-tight">
                VCEcom Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="space-y-4 p-4">
              <FilteredNavigation />
            </nav>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
