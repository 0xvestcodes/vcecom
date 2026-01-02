"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSidebar } from "./admin-shell";

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number | string;
  isChild?: boolean;
  onClick?: () => void;
}

export function NavLink({
  href,
  icon: Icon,
  label,
  badge,
  isChild = false,
  onClick,
}: NavLinkProps) {
  const pathname = usePathname();
  const sidebar = useSidebar();

  // Only match exact paths - no parent/child matching to prevent multiple highlights
  // This ensures only the exact matching link is highlighted
  const isActive = pathname === href;

  const handleClick = () => {
    // Close mobile sidebar when a link is clicked
    if (sidebar && window.innerWidth < 1024) {
      sidebar.setIsMobileOpen(false);
    }
    onClick?.();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
        isChild && "ml-0",
        isActive
          ? "bg-accent/60 text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary")}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 px-1.5 text-[10px] font-medium"
        >
          {badge}
        </Badge>
      )}
    </Link>
  );
}
