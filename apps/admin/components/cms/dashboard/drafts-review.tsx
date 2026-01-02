"use client";

import { AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Draft {
  id: string;
  title: string;
  contentType: string;
  status: "draft" | "review";
  url: string;
}

interface DraftsReviewProps {
  drafts: Draft[];
}

export function DraftsReview({ drafts }: DraftsReviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Drafts Needing Review
          {drafts.length > 0 && (
            <Badge variant="destructive">{drafts.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Drafts submitted for review or pending publication
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No drafts needing review
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.slice(0, 5).map((draft) => (
              <Link
                key={draft.id}
                href={draft.url}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft.contentType}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={draft.status === "review" ? "default" : "secondary"}
                >
                  {draft.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
