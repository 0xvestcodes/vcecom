"use client";

import { formatDistanceToNow } from "date-fns";
import { FileText, Play } from "lucide-react";
import { useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
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
import {
  JobExecution,
  JobStatus,
  useBackgroundJobs,
  useJobHistory,
  useTriggerJob,
} from "@/hooks/admin/use-background-jobs";

export function JobsPageClient() {
  const { data: jobsData, isLoading } = useBackgroundJobs();
  const jobs = jobsData?.jobs || [];

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Background Jobs"
        description="Monitor and manage background jobs"
      >
        <Card>
          <CardHeader>
            <CardTitle>Background Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </AdminPageLayout>
    );
  }

  if (jobs.length === 0) {
    return (
      <AdminPageLayout
        title="Background Jobs"
        description="Monitor and manage background jobs"
      >
        <Card>
          <CardHeader>
            <CardTitle>Background Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">No jobs found</p>
              <p className="text-xs">No background jobs are configured.</p>
            </div>
          </CardContent>
        </Card>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Background Jobs"
      description="Monitor and manage background jobs"
    >
      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard key={job.name} job={job} />
        ))}
      </div>
    </AdminPageLayout>
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
    <Card className="rounded-xl border-border/50 bg-card/50">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColor}`} />
            <CardTitle className="text-sm">{job.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8">
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
              {triggerJob.isPending ? "Triggering..." : "Trigger"}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">{job.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
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
