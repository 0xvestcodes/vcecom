"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHasRole } from "@/hooks/admin/use-permissions";

interface CreateOption {
  label: string;
  href?: string;
  onClick?: () => void;
  requiredRoles?: string[];
}

/**
 * Floating Create Button Component
 *
 * Bottom-right floating button (+):
 * - Opens menu with create options
 * - Context-aware (shows relevant creates)
 * - Like Notion's "New" button
 *
 * @example
 * ```tsx
 * <FloatingCreateButton
 *   options={[
 *     { label: 'Create Product', href: '/products/create' },
 *     { label: 'Create Order', onClick: handleCreateOrder }
 *   ]}
 * />
 * ```
 */
export function FloatingCreateButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasAdmin = useHasRole("admin");
  const hasMarketing = useHasRole("marketing");
  const hasSupport = useHasRole("support");

  // Context-aware create options based on current route
  const getContextOptions = (): CreateOption[] => {
    const options: CreateOption[] = [];

    // Always available
    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Product",
        href: "/products/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Discount",
        href: "/discounts/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Price List",
        href: "/price-lists/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Bundle",
        href: "/bundles/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Category",
        href: "/products/categories/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    if (hasAdmin || hasMarketing) {
      options.push({
        label: "Create Collection",
        href: "/products/collections/create",
        requiredRoles: ["admin", "marketing"],
      });
    }

    // Filter based on roles
    return options.filter((option) => {
      if (!option.requiredRoles) return true;
      return option.requiredRoles.some((role) => {
        switch (role) {
          case "admin":
            return hasAdmin;
          case "marketing":
            return hasMarketing;
          case "support":
            return hasSupport;
          default:
            return false;
        }
      });
    });
  };

  const options = getContextOptions();

  if (options.length === 0) {
    return null;
  }

  const handleOptionClick = (option: CreateOption) => {
    setOpen(false);
    if (option.onClick) {
      option.onClick();
    } else if (option.href) {
      router.push(option.href);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Create new item"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {options.map((option, index) => (
            <DropdownMenuItem
              key={index}
              onClick={() => handleOptionClick(option)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
