"use client";

import { ReactNode } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminPageLayoutProps {
  title: string | ReactNode;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
}

/**
 * Layout component for admin pages
 *
 * Provides consistent page structure with header, breadcrumbs, actions, filters,
 * content area, and pagination. Used as a wrapper for all admin pages.
 *
 * @param title - Page title displayed in the header
 * @param description - Optional description text below the title
 * @param breadcrumbs - Optional breadcrumb navigation items
 * @param actions - Optional action buttons (e.g., "Create", "Export")
 * @param filters - Optional filter bar component
 * @param children - Page content to render
 * @param pagination - Optional pagination component
 *
 * @example
 * ```tsx
 * <AdminPageLayout
 *   title="Products"
 *   description="Manage your product catalog"
 *   actions={<Button>Create Product</Button>}
 *   filters={<ProductFiltersBar />}
 *   pagination={<PaginationControls />}
 * >
 *   <ProductsTable />
 * </AdminPageLayout>
 * ```
 */
export function AdminPageLayout({
  title,
  description,
  breadcrumbs,
  actions,
  filters,
  children,
  pagination,
}: AdminPageLayoutProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <div
                key={`breadcrumb-${index}-${crumb.label}`}
                className="flex items-center"
              >
                {index > 0 && <span className="mx-1.5">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Filters */}
      {filters && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-3">
          {filters}
        </div>
      )}

      {/* Content */}
      <div>{children}</div>

      {/* Pagination */}
      {pagination && (
        <div className="flex justify-center pt-2">{pagination}</div>
      )}
    </div>
  );
}
