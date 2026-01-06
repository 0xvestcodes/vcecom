"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FetchError } from "@/lib/api";

interface ErrorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: FetchError | Error | null;
  title?: string;
  description?: string;
  onRetry?: () => void;
  showDetails?: boolean;
}

/**
 * Graceful error modal component
 * Displays user-friendly error messages instead of raw JSON errors
 */
export function ErrorModal({
  open,
  onOpenChange,
  error,
  title = "Something went wrong",
  description,
  onRetry,
  showDetails = false,
}: ErrorModalProps) {
  if (!error) return null;

  // Extract user-friendly error message
  const getErrorMessage = (err: FetchError | Error): string => {
    if (err instanceof FetchError) {
      // Handle different error statuses
      if (err.status === 401) {
        return "Your session has expired. Please log in again.";
      }
      if (err.status === 403) {
        return "You don't have permission to perform this action.";
      }
      if (err.status === 404) {
        return "The requested resource was not found.";
      }
      if (err.status === 429) {
        return "Too many requests. Please wait a moment and try again.";
      }
      if (err.status >= 500) {
        return "Server error. Please try again later or contact support.";
      }
      if (err.status === 0) {
        return "Network error. Please check your internet connection.";
      }
      // Use error message if available
      if (err.message) {
        return err.message;
      }
    }
    return err.message || "An unexpected error occurred.";
  };

  const errorMessage = getErrorMessage(error);
  const errorDetails =
    error instanceof FetchError && error.errors
      ? Object.entries(error.errors)
          .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
          .join("\n")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description || errorMessage}</DialogDescription>
        </DialogHeader>

        {showDetails && errorDetails && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {errorDetails}
            </p>
          </div>
        )}

        {showDetails && error instanceof FetchError && error.status > 0 && (
          <div className="text-xs text-muted-foreground">
            Error code: {error.status}
          </div>
        )}

        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            The team at Vestcodes has been informed and is working to resolve
            this issue.
          </p>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full sm:w-auto">
            {onRetry && (
              <Button onClick={onRetry} variant="default">
                Try Again
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
