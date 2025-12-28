"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";

interface SidebarSectionProps {
  item: NavItem;
  defaultOpen?: boolean;
}

function isChildActive(item: NavItem, pathname: string): boolean {
  if (!item.children || item.children.length === 0) return false;
  // Only check for exact matches to prevent multiple highlights
  // If a parent and child share the same href, only the child should be highlighted
  return item.children.some((child) => pathname === child.href);
}

export function SidebarSection({
  item,
  defaultOpen = false,
}: SidebarSectionProps) {
  const pathname = usePathname();
  const hasActiveChild = item.children ? isChildActive(item, pathname) : false;
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  if (!item.children || item.children.length === 0) {
    return (
      <NavLink
        href={item.href}
        icon={item.icon}
        label={item.label}
        badge={item.badge}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
          "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
          // Only highlight parent if it's the exact match AND no child is active
          pathname === item.href && !hasActiveChild && "text-foreground",
        )}
      >
        <item.icon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge !== undefined && (
          <span className="ml-auto text-xs">{item.badge}</span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="mt-0.5 space-y-0.5 pl-4">
          {item.children?.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.label}
              badge={child.badge}
              isChild
            />
          ))}
        </div>
      </div>
    </div>
  );
}
