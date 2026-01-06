"use client";

import { AlertCircle, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReindexEntityType,
  useReindexStatus,
  useTriggerReindex,
} from "@/hooks/search/use-reindex";

/**
 * Reindex Card Component
 * Allows triggering and monitoring reindex operations
 */
export function ReindexCard() {
  const { data: status, isLoading: statusLoading } = useReindexStatus();
  const { mutate: triggerReindex, isPending: isTriggering } =
    useTriggerReindex();

  const [entityType, setEntityType] = useState<ReindexEntityType>(
    ReindexEntityType.ALL,
  );
  const [batchSize, setBatchSize] = useState<number>(100);

  const handleTriggerReindex = () => {
    triggerReindex(
      {
        entityType,
        batchSize,
      },
      {
        onSuccess: () => {
          toast.success("Reindex Started", {
            description: "The reindex operation has been started.",
          });
        },
        onError: (error) => {
          toast.error("Error", {
            description: error.message || "Failed to start reindex",
          });
        },
      },
    );
  };

  const isRunning = status?.status === "running";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle>Reindex Operations</CardTitle>
          </div>
          <CardDescription>
            Trigger a full or partial reindex of search indexes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reindex Status */}
          {statusLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : status ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm font-medium text-blue-500">
                        Running
                      </span>
                    </>
                  ) : status.status === "completed" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-500">
                        Completed
                      </span>
                    </>
                  ) : status.status === "failed" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-500">
                        Failed
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      Idle
                    </span>
                  )}
                </div>
              </div>

              {isRunning && status.progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {status.progress.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={status.progress.percentage} />
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-medium">
                        {status.progress.total.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Processed:</span>{" "}
                      <span className="font-medium text-green-500">
                        {status.progress.processed.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>{" "}
                      <span className="font-medium text-red-500">
                        {status.progress.failed.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {status.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{status.error}</AlertDescription>
                </Alert>
              )}

              {status.startedAt && (
                <div className="text-sm text-muted-foreground">
                  Started: {new Date(status.startedAt).toLocaleString()}
                </div>
              )}
              {status.completedAt && (
                <div className="text-sm text-muted-foreground">
                  Completed: {new Date(status.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : null}

          {/* Reindex Controls */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select
                value={entityType}
                onValueChange={(value) =>
                  setEntityType(value as ReindexEntityType)
                }
                disabled={isRunning || isTriggering}
              >
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ReindexEntityType.ALL}>All</SelectItem>
                  <SelectItem value={ReindexEntityType.PRODUCTS}>
                    Products
                  </SelectItem>
                  <SelectItem value={ReindexEntityType.COLLECTIONS}>
                    Collections
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                min={1}
                value={batchSize}
                onChange={(e) =>
                  setBatchSize(parseInt(e.target.value, 10) || 100)
                }
                disabled={isRunning || isTriggering}
              />
              <p className="text-xs text-muted-foreground">
                Number of documents to process per batch
              </p>
            </div>

            <Button
              onClick={handleTriggerReindex}
              disabled={isRunning || isTriggering}
              className="w-full"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Reindex
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
