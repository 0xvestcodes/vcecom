"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface EditorPanelProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  status?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
  saveLabel?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  sidebar?: ReactNode;
  warningActions?: ReactNode;
}

/**
 * Universal Editor Panel Component
 *
 * 2-column editor layout:
 * - Left Column (70%): Main content with collapsible sections
 * - Right Column (30%): Status pill, summary, quick actions, meta info
 * - Top bar: Breadcrumb + Status + Save button
 * - Bottom: Warning actions (Delete, Archive) in red section
 *
 * @example
 * ```tsx
 * <EditorPanel
 *   title="Product Name"
 *   breadcrumbs={[{ label: 'Products', href: '/products' }, { label: 'Edit' }]}
 *   status={{ label: 'Draft', variant: 'outline' }}
 *   onSave={handleSave}
 *   sidebar={<ProductSidebar />}
 *   warningActions={<DeleteButton />}
 * >
 *   <CollapsibleSection title="Basic Info">...</CollapsibleSection>
 *   <CollapsibleSection title="Pricing">...</CollapsibleSection>
 * </EditorPanel>
 * ```
 */
export function EditorPanel({
  title,
  breadcrumbs,
  status,
  onSave,
  isSaving = false,
  saveLabel = "Save",
  backHref,
  backLabel = "Back",
  children,
  sidebar,
  warningActions,
}: EditorPanelProps) {
  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
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
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{crumb.label}</span>
                  )}
                </div>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {status && (
              <Badge variant={status.variant || "default"}>
                {status.label}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backHref && (
            <Button variant="outline" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          )}
          {onSave && (
            <Button onClick={onSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : saveLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column - Main Content (70%) */}
        <div className="lg:col-span-7 space-y-4">{children}</div>

        {/* Right Column - Sidebar (30%) */}
        {sidebar && (
          <div className="lg:col-span-3 space-y-4">
            <div className="sticky top-4 space-y-4">{sidebar}</div>
          </div>
        )}
      </div>

      {/* Warning Actions Section */}
      {warningActions && (
        <>
          <Separator />
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-destructive">
                Danger Zone
              </h3>
              {warningActions}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
