"use client";

import { AlertTriangle, CheckCircle, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LinkHealthProps {
  errorsCount: number;
  warningsCount: number;
}

export function LinkHealth({ errorsCount, warningsCount }: LinkHealthProps) {
  const hasIssues = errorsCount > 0 || warningsCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Link Health
          {hasIssues && (
            <Badge variant={errorsCount > 0 ? "destructive" : "default"}>
              {errorsCount} errors, {warningsCount} warnings
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Validation status of internal and external links
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasIssues ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm font-medium">All links are valid</p>
            <p className="text-xs text-muted-foreground mt-1">
              No broken or problematic links found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium">
                    {errorsCount} broken link{errorsCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Links pointing to non-existent pages or entities
                  </p>
                </div>
              </div>
              {errorsCount > 0 && (
                <Link href="/cms/seo">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              )}
            </div>

            {warningsCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <LinkIcon className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">
                      {warningsCount} warning{warningsCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Links to draft content or unpublished entities
                    </p>
                  </div>
                </div>
                <Link href="/cms/seo">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
