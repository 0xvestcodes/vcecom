/**
 * Centralized navigation structure
 * Route definitions and icon mappings
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  CreditCard,
  DollarSign,
  FileSearch,
  FileText,
  FolderOpen,
  FolderTree,
  Gift,
  HardDrive,
  LayoutDashboard,
  MessageSquare,
  Package,
  Percent,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type AdminRole =
  | "admin"
  | "customer"
  | "support"
  | "reviewer"
  | "marketing";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  children?: NavItem[];
  requiredRoles?: AdminRole[]; // Roles required to access this navigation item
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        requiredRoles: ["admin", "support", "reviewer", "marketing"],
        children: [
          {
            label: "Overview",
            href: "/",
            icon: LayoutDashboard,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
          {
            label: "Performance",
            href: "/dashboards/performance",
            icon: TrendingUp,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
          {
            label: "Operations",
            href: "/dashboards/operations",
            icon: Truck,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
          {
            label: "Customer & Support",
            href: "/dashboards/customer-support",
            icon: MessageSquare,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
          {
            label: "Product & Merchandising",
            href: "/dashboards/product-merchandising",
            icon: BarChart3,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
        ],
      },
    ],
  },
  {
    label: "Orders",
    items: [
      {
        label: "Orders",
        href: "/orders",
        icon: ShoppingCart,
        requiredRoles: ["admin", "support"],
        children: [
          {
            label: "All Orders",
            href: "/orders",
            icon: ShoppingCart,
            requiredRoles: ["admin", "support"],
          },
          {
            label: "Abandoned Checkouts",
            href: "/orders/abandoned",
            icon: ShoppingBag,
            requiredRoles: ["admin", "support"],
          },
        ],
      },
    ],
  },
  {
    label: "Products",
    items: [
      {
        label: "Products",
        href: "/products",
        icon: Package,
        requiredRoles: ["admin", "marketing"],
        children: [
          {
            label: "All Products",
            href: "/products",
            icon: Package,
            requiredRoles: ["admin", "marketing"],
          },
          {
            label: "Create Product",
            href: "/products/create",
            icon: Plus,
            requiredRoles: ["admin", "marketing"],
          },
        ],
      },
      {
        label: "Categories",
        href: "/products/categories",
        icon: FolderTree,
        requiredRoles: ["admin", "marketing"],
      },
      {
        label: "Collections",
        href: "/products/collections",
        icon: FolderOpen,
        requiredRoles: ["admin", "marketing"],
      },
      {
        label: "Bundles",
        href: "/bundles",
        icon: Boxes,
        requiredRoles: ["admin", "marketing"],
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        requiredRoles: ["admin"],
        children: [
          {
            label: "All Inventory",
            href: "/inventory",
            icon: Boxes,
            requiredRoles: ["admin"],
          },
          {
            label: "Health",
            href: "/inventory/health",
            icon: TrendingUp,
            requiredRoles: ["admin"],
          },
          {
            label: "Settings",
            href: "/inventory/settings",
            icon: Settings,
            requiredRoles: ["admin"],
          },
          {
            label: "Bulk Adjust",
            href: "/inventory/bulk-adjust",
            icon: Plus,
            requiredRoles: ["admin"],
          },
        ],
      },
      {
        label: "Reviews",
        href: "/reviews",
        icon: Star,
        requiredRoles: ["admin", "reviewer"],
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: Users,
        requiredRoles: ["admin", "support"],
      },
      {
        label: "Customer Groups",
        href: "/customer-groups",
        icon: UserCog,
        requiredRoles: ["admin", "marketing"],
      },
      {
        label: "Wallets",
        href: "/wallet",
        icon: Wallet,
        requiredRoles: ["admin", "support"],
      },
      {
        label: "Loyalty Rules",
        href: "/loyalty",
        icon: Gift,
        requiredRoles: ["admin", "marketing"],
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        label: "Discounts",
        href: "/discounts",
        icon: Tag,
        requiredRoles: ["admin", "marketing"],
      },
      {
        label: "Price Lists",
        href: "/price-lists",
        icon: DollarSign,
        requiredRoles: ["admin", "marketing"],
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        label: "Blog Posts",
        href: "/cms/blog",
        icon: BookOpen,
        requiredRoles: ["admin", "support", "reviewer", "marketing"],
        children: [
          {
            label: "All Posts",
            href: "/cms/blog",
            icon: BookOpen,
            requiredRoles: ["admin", "support", "reviewer", "marketing"],
          },
          {
            label: "Create Post",
            href: "/cms/blog/create",
            icon: Plus,
            requiredRoles: ["admin", "marketing"],
          },
        ],
      },
      {
        label: "Media",
        href: "/cms/media",
        icon: FolderOpen,
        requiredRoles: ["admin", "support", "reviewer", "marketing"],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Store Settings",
        href: "/settings/store",
        icon: Store,
        requiredRoles: ["admin"],
      },
      {
        label: "Currency",
        href: "/settings/currency",
        icon: DollarSign,
        requiredRoles: ["admin"],
      },
      {
        label: "Shipping Methods",
        href: "/settings/shipping-methods",
        icon: Truck,
        requiredRoles: ["admin"],
      },
      {
        label: "Payment Fees",
        href: "/settings/payment-fees",
        icon: CreditCard,
        requiredRoles: ["admin"],
      },
      {
        label: "Tax Management",
        href: "/tax",
        icon: Percent,
        requiredRoles: ["admin"],
        children: [
          {
            label: "Tax Rules",
            href: "/tax/rules",
            icon: Percent,
            requiredRoles: ["admin"],
          },
          {
            label: "Tax Exemptions",
            href: "/tax/exemptions",
            icon: Receipt,
            requiredRoles: ["admin"],
          },
          {
            label: "HSN Codes",
            href: "/tax/hsn-codes",
            icon: FileText,
            requiredRoles: ["admin"],
          },
          {
            label: "Tax Audit Logs",
            href: "/tax/audit",
            icon: FileSearch,
            requiredRoles: ["admin"],
          },
        ],
      },
      {
        label: "Roles & Permissions",
        href: "/settings/roles",
        icon: UserCog,
        requiredRoles: ["admin"],
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        requiredRoles: ["admin"],
      },
      {
        label: "Search",
        href: "/settings/search",
        icon: Search,
        requiredRoles: ["admin"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Storage",
        href: "/storage",
        icon: HardDrive,
        requiredRoles: ["admin"],
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        requiredRoles: ["admin"],
      },
      {
        label: "Activity Logs",
        href: "/activity-logs",
        icon: BookOpen,
        requiredRoles: ["admin"],
      },
      {
        label: "System Logs",
        href: "/settings/system-logs",
        icon: FileText,
        requiredRoles: ["admin"],
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: FileSearch,
        requiredRoles: ["admin"],
      },
    ],
  },
];

/**
 * Get all navigation items flattened (for search)
 */
export function getAllNavItems(): NavItem[] {
  const items: NavItem[] = [];
  navigation.forEach((section) => {
    section.items.forEach((item) => {
      items.push(item);
      if (item.children) {
        items.push(...item.children);
      }
    });
  });
  return items;
}

/**
 * Find nav item by href
 */
export function findNavItemByHref(href: string): NavItem | undefined {
  for (const section of navigation) {
    for (const item of section.items) {
      if (item.href === href) {
        return item;
      }
      if (item.children) {
        const child = item.children.find((c) => c.href === href);
        if (child) return child;
      }
    }
  }
  return undefined;
}
