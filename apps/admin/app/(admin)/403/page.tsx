"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminSession } from "@/providers/session-provider";

export default function ForbiddenPage() {
  const { session } = useAdminSession();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="rounded-lg bg-destructive/10 p-3">
              <svg
                className="h-8 w-8 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Warning icon"
              >
                <title>Warning</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Access Forbidden
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            You don't have permission to access this page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Your current role:
              </p>
              <p className="text-sm font-medium capitalize">{session.role}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full text-sm">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              If you believe this is an error, please contact your
              administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
