"use client";

import { ChevronDown } from "lucide-react";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
  headerActions?: ReactNode;
  hasUnsavedChanges?: boolean;
}

/**
 * Collapsible Section Component
 *
 * Notion-style collapsible sections used in Editor Panels:
 * - Save state per section
 * - Visual indicator when unsaved
 * - Smooth expand/collapse animation
 *
 * @example
 * ```tsx
 * <CollapsibleSection
 *   title="Basic Information"
 *   defaultOpen
 *   hasUnsavedChanges={hasChanges}
 * >
 *   <FormField>...</FormField>
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  onToggle,
  className,
  headerActions,
  hasUnsavedChanges = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card transition-all duration-200",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              !isOpen && "-rotate-90",
            )}
          />
          <h3 className="font-medium text-sm">{title}</h3>
          {hasUnsavedChanges && (
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
          )}
        </div>
        {headerActions && (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            {headerActions}
          </div>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
