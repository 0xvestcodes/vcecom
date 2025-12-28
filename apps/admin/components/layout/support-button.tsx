"use client";

import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Support button component for header
 * Links to the support page
 */
export function SupportButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
    >
      <Link href="/support">
        <HelpCircle className="mr-2 h-3.5 w-3.5" />
        <span className="hidden md:inline">Support</span>
      </Link>
    </Button>
  );
}
