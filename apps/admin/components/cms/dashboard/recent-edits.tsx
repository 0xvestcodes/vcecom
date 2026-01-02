"use client";

import { formatDistanceToNow } from "date-fns";
import { FileEdit } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RecentEdit {
  id: string;
  title: string;
  contentType: string;
  updatedAt: Date;
  updatedBy?: string;
  url: string;
}

interface RecentEditsProps {
  entries: RecentEdit[];
}

export function RecentEdits({ entries }: RecentEditsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Edits</CardTitle>
        <CardDescription>Recently edited entries and blocks</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent edits</p>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 5).map((entry) => (
              <Link
                key={entry.id}
                href={entry.url}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileEdit className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.contentType}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                  {entry.updatedBy && (
                    <p className="text-xs text-muted-foreground">
                      by {entry.updatedBy}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
