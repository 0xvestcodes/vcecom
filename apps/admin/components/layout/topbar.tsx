"use client";

import { LogOut, Menu, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommandK } from "@/hooks/use-command-k";
import { useAdminSession } from "@/providers/session-provider";
import { useSidebar } from "./admin-shell";
import { NotificationBell } from "./notification-bell";
import { SupportButton } from "./support-button";

interface TopbarProps {
  onSearchClick?: () => void;
}

export function Topbar({ onSearchClick }: TopbarProps) {
  const { session, logout } = useAdminSession();
  const { openCommandPalette } = useCommandK();
  const sidebar = useSidebar();

  const handleMenuClick = () => {
    if (sidebar) {
      sidebar.setIsMobileOpen(true);
    }
  };

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      openCommandPalette();
    }
  };

  const getInitials = (email: string) => {
    return email.split("@")[0].slice(0, 2).toUpperCase();
  };

  const _getEnvironmentBadge = () => {
    const env = process.env.NEXT_PUBLIC_ENV || "development";
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      production: "destructive",
      staging: "secondary",
      development: "default",
    };
    return (
      <Badge variant={variants[env] || "default"} className="text-xs">
        {env}
      </Badge>
    );
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-sm px-4">
      <div className="flex items-center gap-2">
        {/* Mobile menu button */}
        {sidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMenuClick}
            className="lg:hidden h-9 w-9 p-0"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Search */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSearchClick}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search...</span>
          <kbd className="pointer-events-none hidden h-4 select-none items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </Button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationBell />

        {/* Support */}
        <SupportButton />

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-9 px-2 hover:bg-accent/50 transition-all duration-200"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {session?.email ? getInitials(session.email) : "A"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left md:flex">
                <span className="text-xs font-medium">
                  {session?.email?.split("@")[0] || "Admin"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {session?.role || "admin"}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-medium leading-none">
                  {session?.email || "Admin"}
                </p>
                <p className="text-[10px] leading-none text-muted-foreground">
                  {session?.role || "admin"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" asChild>
              <Link href="/profile">
                <User className="mr-2 h-3.5 w-3.5" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-3.5 w-3.5" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-xs text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
