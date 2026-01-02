"use client";

import { formatDistanceToNow } from "date-fns";
import { Database, FileText, Play } from "lucide-react";
import { useState } from "react";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  JobExecution,
  JobStatus,
  useBackgroundJobs,
  useJobHistory,
  useTriggerJob,
} from "@/hooks/admin/use-background-jobs";
import {
  RedisHealthStatus,
  useRedisHealth,
  useRedisKeys,
} from "@/hooks/admin/use-redis-health";

/**
 * Refactored System Logs using SettingsSheet pattern
 * Uses collapsible sections instead of tabs
 */
export function SystemLogsRefactored() {
  const { data: redisHealth, isLoading: isLoadingRedis } = useRedisHealth();
  const { data: redisKeys } = useRedisKeys();
  const { data: jobsData, isLoading: isLoadingJobs } = useBackgroundJobs();
  const jobs = jobsData?.jobs || [];

  const handleSave = async () => {
    // System logs are read-only, no save needed
    console.log("System logs are read-only");
  };

  return (
    <SettingsSheet
      title="System Logs"
      description="View system logs, errors, and performance metrics"
      onSave={undefined}
      isSaving={false}
    >
      <CollapsibleSection title="Redis Health" defaultOpen>
        <RedisHealthContent
          health={redisHealth}
          keys={redisKeys}
          isLoading={isLoadingRedis}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Background Jobs" defaultOpen={false}>
        <BackgroundJobsContent jobs={jobs} isLoading={isLoadingJobs} />
      </CollapsibleSection>
    </SettingsSheet>
  );
}

function RedisHealthContent({
  health,
  keys,
  isLoading,
}: {
  health?: RedisHealthStatus;
  keys?: Record<string, number>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!health) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">No data available</p>
        <p className="text-xs">Unable to fetch Redis health data.</p>
      </div>
    );
  }

  const statusColor =
    health.status === "healthy"
      ? "bg-green-500"
      : health.status === "degraded"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <CardTitle className="text-sm">Redis Health</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Redis connection status and metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Connection Status</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${statusColor}`} />
              <span className="text-sm capitalize">{health.status}</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Status: {health.connection.status}
            {health.connection.latency && (
              <span className="ml-2">
                • Latency: {health.connection.latency}ms
              </span>
            )}
          </div>
        </div>

        {/* Memory Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Memory Usage</span>
            <span className="text-sm text-muted-foreground">
              {health.memory.percentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={health.memory.percentage} className="h-2" />
          <div className="text-sm text-muted-foreground mt-1">
            {formatBytes(health.memory.used)} /{" "}
            {health.memory.total > 0
              ? formatBytes(health.memory.total)
              : "Unlimited"}
          </div>
        </div>

        {/* Clients */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium">Connected Clients</div>
            <div className="text-lg font-bold">{health.clients.connected}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Blocked Clients</div>
            <div className="text-lg font-bold">{health.clients.blocked}</div>
          </div>
        </div>

        {/* Keyspace */}
        <div>
          <div className="text-sm font-medium mb-2">Keyspace</div>
          <div className="text-lg font-bold mb-2">
            {health.keyspace.totalKeys.toLocaleString()} keys
          </div>
          {keys && Object.keys(keys).length > 0 && (
            <div className="space-y-1">
              {Object.entries(keys).map(([pattern, count]) => (
                <div
                  key={pattern}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground font-mono">
                    {pattern}
                  </span>
                  <span className="font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Replication */}
        {health.replication && (
          <div>
            <div className="text-sm font-medium mb-2">Replication</div>
            <div className="text-sm text-muted-foreground">
              Role:{" "}
              <span className="capitalize">{health.replication.role}</span>
              {health.replication.connectedSlaves !== undefined && (
                <span className="ml-2">
                  • Connected Slaves: {health.replication.connectedSlaves}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BackgroundJobsContent({
  jobs,
  isLoading,
}: {
  jobs: JobStatus[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium mb-1">No jobs found</p>
        <p className="text-xs">No background jobs are configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.name} job={job} />
      ))}
    </div>
  );
}

function JobCard({ job }: { job: JobStatus }) {
  const [showHistory, setShowHistory] = useState(false);
  const { data: historyData } = useJobHistory(showHistory ? job.name : "");
  const triggerJob = useTriggerJob();

  const statusColor =
    job.status === "running"
      ? "bg-blue-500"
      : job.status === "error"
        ? "bg-red-500"
        : "bg-gray-500";

  const successRate =
    job.executionCount > 0
      ? ((job.successCount / job.executionCount) * 100).toFixed(1)
      : "0";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColor}`} />
            <CardTitle className="text-sm">{job.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setShowHistory(true)}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-sm">
                    Execution History: {job.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Recent execution history for this background job
                  </DialogDescription>
                </DialogHeader>
                <JobHistoryContent history={historyData?.history || []} />
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => triggerJob.mutate({ jobName: job.name })}
              disabled={triggerJob.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-2" />
              Trigger
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">{job.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Schedule</div>
            <div className="text-xs font-medium font-mono">{job.schedule}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge
              variant={job.status === "error" ? "destructive" : "secondary"}
              className="text-xs"
            >
              {job.status}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Run</div>
            <div className="text-xs font-medium">
              {job.lastRun
                ? formatDistanceToNow(new Date(job.lastRun), {
                    addSuffix: true,
                  })
                : "Never"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Next Run</div>
            <div className="text-xs font-medium">
              {job.nextRun
                ? formatDistanceToNow(new Date(job.nextRun), {
                    addSuffix: true,
                  })
                : "Unknown"}
            </div>
          </div>
        </div>

        {job.lastDuration !== undefined && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              Last Duration
            </div>
            <div className="text-xs font-medium">{job.lastDuration}ms</div>
          </div>
        )}

        {job.lastError && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Last Error</div>
            <div className="text-xs text-red-600 bg-red-50/50 p-2 rounded-lg">
              {job.lastError}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border/50">
          <div>
            <div className="text-xs text-muted-foreground">
              Total Executions
            </div>
            <div className="text-sm font-bold">{job.executionCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Success</div>
            <div className="text-sm font-bold text-green-600">
              {job.successCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
            <div className="text-sm font-bold">{successRate}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobHistoryContent({ history }: { history: JobExecution[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
        <p className="text-sm font-medium mb-1">
          No execution history available
        </p>
        <p className="text-xs">Execution history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {history.map((execution) => {
        const startTime =
          execution.startTime instanceof Date
            ? execution.startTime
            : new Date(execution.startTime);
        return (
          <div
            key={`${execution.jobName}-${startTime.toISOString()}`}
            className="border border-border/50 rounded-xl bg-card/50 p-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    execution.status === "success"
                      ? "default"
                      : execution.status === "failure"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {execution.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(startTime, {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {execution.duration && (
                <span className="text-xs font-medium">
                  {execution.duration}ms
                </span>
              )}
            </div>
            {execution.error && (
              <div className="text-xs text-red-600 mt-2 bg-red-50/50 p-2 rounded-lg">
                {execution.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
