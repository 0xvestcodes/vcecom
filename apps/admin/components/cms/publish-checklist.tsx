"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  status: "valid" | "error" | "warning";
  fieldName?: string; // Field name to scroll to when clicked
  onClick?: () => void;
}

interface PublishChecklistProps {
  valid: boolean;
  errors: string[];
  warnings: string[];
  onItemClick?: (fieldName?: string) => void;
  className?: string;
}

/**
 * Transforms API error/warning strings into user-friendly checklist items
 */
function transformToChecklistItems(
  errors: string[],
  warnings: string[],
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Common patterns to extract field names and transform messages
  const fieldPatterns = [
    {
      pattern: /required field ['"](.+?)['"]/i,
      transform: (match: RegExpMatchArray) => ({
        label: `${match[1]} field is required`,
        fieldName: match[1],
      }),
    },
    {
      pattern: /field ['"](.+?)['"]/i,
      transform: (match: RegExpMatchArray) => ({
        label: `${match[1]} field has an issue`,
        fieldName: match[1],
      }),
    },
    {
      pattern: /slug ['"](.+?)['"] already exists/i,
      transform: () => ({
        label: "Slug must be unique",
        fieldName: "slug",
      }),
    },
    {
      pattern: /slug/i,
      transform: () => ({
        label: "Slug is valid",
        fieldName: "slug",
      }),
    },
    {
      pattern: /reference.*entry.*['"](.+?)['"]/i,
      transform: () => ({
        label: "1 broken reference (click to fix)",
        fieldName: undefined,
      }),
    },
    {
      pattern: /reference/i,
      transform: () => ({
        label: "References are valid",
        fieldName: undefined,
      }),
    },
    {
      pattern: /content type rules/i,
      transform: () => ({
        label: "Content type rules are valid",
        fieldName: undefined,
      }),
    },
  ];

  // Process errors
  errors.forEach((error, index) => {
    let transformed = false;
    for (const { pattern, transform } of fieldPatterns) {
      const match = error.match(pattern);
      if (match) {
        const result = transform(match);
        items.push({
          id: `error-${index}`,
          label: result.label,
          status: "error",
          fieldName: result.fieldName,
        });
        transformed = true;
        break;
      }
    }
    if (!transformed) {
      // Fallback: use error as-is
      items.push({
        id: `error-${index}`,
        label: error,
        status: "error",
      });
    }
  });

  // Process warnings
  warnings.forEach((warning, index) => {
    let transformed = false;
    for (const { pattern, transform } of fieldPatterns) {
      const match = warning.match(pattern);
      if (match) {
        const result = transform(match);
        items.push({
          id: `warning-${index}`,
          label: result.label,
          status: "warning",
          fieldName: result.fieldName,
        });
        transformed = true;
        break;
      }
    }
    if (!transformed) {
      items.push({
        id: `warning-${index}`,
        label: warning,
        status: "warning",
      });
    }
  });

  // Add default valid items if no errors/warnings
  if (items.length === 0) {
    items.push(
      {
        id: "required-fields",
        label: "All required fields filled",
        status: "valid",
      },
      {
        id: "slug-valid",
        label: "Slug valid",
        status: "valid",
      },
      {
        id: "references-valid",
        label: "References valid",
        status: "valid",
      },
      {
        id: "content-type-rules",
        label: "Content type rules valid",
        status: "valid",
      },
    );
  } else {
    // Add valid items for common checks that aren't mentioned
    const _mentionedFields = new Set(
      items.map((item) => item.fieldName).filter(Boolean),
    );
    const mentionedLabels = items.map((item) => item.label.toLowerCase());

    if (!mentionedLabels.some((l) => l.includes("required"))) {
      items.unshift({
        id: "required-fields",
        label: "All required fields filled",
        status: "valid",
      });
    }
    if (!mentionedLabels.some((l) => l.includes("slug"))) {
      items.push({
        id: "slug-valid",
        label: "Slug valid",
        status: "valid",
      });
    }
    if (!mentionedLabels.some((l) => l.includes("reference"))) {
      items.push({
        id: "references-valid",
        label: "References valid",
        status: "valid",
      });
    }
    if (!mentionedLabels.some((l) => l.includes("content type"))) {
      items.push({
        id: "content-type-rules",
        label: "Content type rules valid",
        status: "valid",
      });
    }
  }

  return items;
}

/**
 * Publish Checklist Component
 * Converts publish readiness errors/warnings into a visual checklist
 */
export function PublishChecklist({
  valid,
  errors,
  warnings,
  onItemClick,
  className,
}: PublishChecklistProps) {
  const items = transformToChecklistItems(errors, warnings);

  const handleItemClick = (item: ChecklistItem) => {
    if (item.fieldName && onItemClick) {
      onItemClick(item.fieldName);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Publish Checklist</h3>
        {valid && (
          <span className="text-xs text-green-600 dark:text-green-500 font-medium">
            All checks passed
          </span>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {items.map((item) => {
            const isClickable = item.fieldName || item.onClick;
            const Component = isClickable ? "button" : "div";
            return (
              <Component
                key={item.id}
                type={isClickable ? "button" : undefined}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-md transition-colors w-full text-left",
                  isClickable && "hover:bg-muted/50 cursor-pointer",
                  item.status === "error" && "bg-destructive/5",
                  item.status === "warning" && "bg-yellow-500/5",
                )}
                onClick={() => isClickable && handleItemClick(item)}
              >
                {item.status === "valid" && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                )}
                {item.status === "error" && (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                )}
                {item.status === "warning" && (
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm flex-1",
                    item.status === "error" && "text-destructive",
                    item.status === "warning" &&
                      "text-yellow-700 dark:text-yellow-400",
                    item.status === "valid" && "text-muted-foreground",
                    isClickable && "underline decoration-dotted",
                  )}
                >
                  {item.label}
                </span>
              </Component>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
