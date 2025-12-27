"use client";

import React, { cloneElement, isValidElement, type ReactNode } from "react";
import { useCanAccess } from "@/hooks/admin/use-permissions";
import type { AdminRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface ProtectedButtonProps {
  requiredRoles: AdminRole[];
  hideIfNoAccess?: boolean;
  disabledIfNoAccess?: boolean;
  children: ReactNode;
  className?: string;
  [key: string]: unknown; // Allow other button props to pass through
}

/**
 * ProtectedButton - Conditionally renders buttons based on user roles
 *
 * @param requiredRoles - Array of roles that can access this button
 * @param hideIfNoAccess - If true, button is hidden when user lacks access (default: true)
 * @param disabledIfNoAccess - If true, button is disabled when user lacks access (default: false)
 * @param children - Button content (should be a Button component)
 */
export function ProtectedButton({
  requiredRoles,
  hideIfNoAccess = true,
  disabledIfNoAccess = false,
  children,
  className,
  ...props
}: ProtectedButtonProps) {
  const canAccess = useCanAccess(requiredRoles);

  // Hide button if user doesn't have access and hideIfNoAccess is true
  if (!canAccess && hideIfNoAccess) {
    return null;
  }

  // Disable button if user doesn't have access and disabledIfNoAccess is true
  const isDisabled = !canAccess && disabledIfNoAccess;

  // Clone the children (button) and add disabled prop if needed
  if (isValidElement(children)) {
    return (
      <>
        {cloneElement(
          children as React.ReactElement<{
            disabled?: boolean;
            "aria-disabled"?: boolean;
          }>,
          {
            disabled:
              isDisabled ||
              (children.props as { disabled?: boolean })?.disabled,
            "aria-disabled":
              isDisabled ||
              (children.props as { "aria-disabled"?: boolean })?.[
                "aria-disabled"
              ],
            className: cn(
              className,
              (children.props as { className?: string })?.className,
            ),
          },
        )}
      </>
    );
  }

  return (
    <div
      className={cn(className, isDisabled && "opacity-50 pointer-events-none")}
      {...props}
    >
      {children}
    </div>
  );
}
