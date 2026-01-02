"use client";

import { MoreHorizontal } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionDropdownProps {
  actions: ActionItem[];
  trigger?: ReactNode;
}

/**
 * Action Dropdown Component
 *
 * Consistent 3-dot menu:
 * - Icon + label for each action
 * - Destructive actions grouped separately
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <ActionDropdown
 *   actions={[
 *     { label: 'Edit', onClick: handleEdit },
 *     { label: 'Duplicate', onClick: handleDuplicate },
 *     { label: 'Delete', onClick: handleDelete, destructive: true }
 *   ]}
 * />
 * ```
 */
export function ActionDropdown({ actions, trigger }: ActionDropdownProps) {
  const normalActions = actions.filter((a) => !a.destructive);
  const destructiveActions = actions.filter((a) => a.destructive);

  if (actions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {normalActions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
        {destructiveActions.length > 0 && normalActions.length > 0 && (
          <DropdownMenuSeparator />
        )}
        {destructiveActions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className="text-destructive focus:text-destructive"
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
