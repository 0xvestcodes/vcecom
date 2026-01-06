"use client";

import { AlertCircle } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error | null;
    resetError: () => void;
  }>;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return (
          <Fallback error={this.state.error} resetError={this.resetError} />
        );
      }

      return (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <DialogTitle>Something went wrong</DialogTitle>
              </div>
              <DialogDescription>
                An unexpected error occurred. Please try again or contact
                support if the problem persists.
              </DialogDescription>
            </DialogHeader>

            {this.state.error && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-mono text-muted-foreground">
                  {this.state.error.message || "Unknown error"}
                </p>
              </div>
            )}

            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                The team at Vestcodes has been informed and is working to
                resolve this issue.
              </p>
            </div>

            <DialogFooter>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={this.resetError} variant="default">
                  Try Again
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  variant="outline"
                >
                  Go Home
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    return this.props.children;
  }
}
