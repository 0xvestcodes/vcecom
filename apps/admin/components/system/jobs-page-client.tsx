"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  FileText,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  JobExecution,
  JobStatus,
  useBackgroundJobs,
  useJobHistory,
  useTriggerJob,
} from "@/hooks/admin/use-background-jobs";
import {
  type QueueInfo,
  type QueueJobInfo,
  useDeadLetterJobs,
  usePauseQueue,
  useQueueJobs,
  useQueueMetrics,
  useQueues,
  useRemoveJob,
  useResumeQueue,
  useRetryJob,
} from "@/hooks/admin/use-queue-monitoring";

export function JobsPageClient() {
  const { data: jobsData, isLoading: isLoadingJobs } = useBackgroundJobs();
  const { data: queuesData, isLoading: isLoadingQueues } = useQueues();
  const { data: metricsData } = useQueueMetrics();
  const { data: deadLetterData } = useDeadLetterJobs();

  const jobs = jobsData?.jobs || [];
  const queues = queuesData?.queues || [];
  const metrics = metricsData || {
    queues: 0,
    totalWaiting: 0,
    totalActive: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalDelayed: 0,
    deadLetterQueue: { total: 0, waiting: 0, active: 0 },
  };

  return (
    <AdminPageLayout
      title="Background Jobs"
      description="Monitor and manage background jobs and queues"
    >
      <Tabs defaultValue="queues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="jobs">Legacy Jobs</TabsTrigger>
          <TabsTrigger value="dead-letter">
            Dead Letter Queue
            {deadLetterData?.stats.total ? (
              <Badge variant="destructive" className="ml-2">
                {deadLetterData.stats.total}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-4">
          {isLoadingQueues ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-sm text-muted-foreground text-center">
                  Loading queues...
                </div>
              </CardContent>
            </Card>
          ) : queues.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">No queues found</p>
                  <p className="text-xs">No queues are configured.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <QueueMetricsCard metrics={metrics} />
              <div className="space-y-4">
                {queues.map((queue) => (
                  <QueueCard key={queue.name} queue={queue} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {isLoadingJobs ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-sm text-muted-foreground text-center">
                  Loading jobs...
                </div>
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">No jobs found</p>
                  <p className="text-xs">No background jobs are configured.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <JobCard key={job.name} job={job} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dead-letter" className="space-y-4">
          <DeadLetterQueueContent />
        </TabsContent>
      </Tabs>
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

function QueueMetricsCard({
  metrics,
}: {
  metrics: {
    queues: number;
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalDelayed: number;
    deadLetterQueue: { total: number; waiting: number; active: number };
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Queue Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Total Queues</div>
            <div className="text-lg font-bold">{metrics.queues}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Waiting</div>
            <div className="text-lg font-bold text-yellow-600">
              {metrics.totalWaiting}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-lg font-bold text-blue-600">
              {metrics.totalActive}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-lg font-bold text-red-600">
              {metrics.totalFailed}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-lg font-bold text-green-600">
              {metrics.totalCompleted}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Delayed</div>
            <div className="text-lg font-bold text-orange-600">
              {metrics.totalDelayed}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Dead Letter</div>
            <div className="text-lg font-bold text-red-600">
              {metrics.deadLetterQueue.total}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueCard({ queue }: { queue: QueueInfo }) {
  const [showJobs, setShowJobs] = useState(false);
  const [jobStatus, setJobStatus] = useState<
    "waiting" | "active" | "completed" | "failed" | "delayed"
  >("waiting");
  const { data: jobsData } = useQueueJobs(queue.name, jobStatus);
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const jobs = jobsData?.jobs || [];

  return (
    <Card className="rounded-xl border-border/50 bg-card/50">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                queue.stats.paused ? "bg-gray-500" : "bg-green-500"
              }`}
            />
            <CardTitle className="text-sm">{queue.name}</CardTitle>
            {queue.stats.paused && (
              <Badge variant="secondary" className="text-xs">
                Paused
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {queue.stats.paused ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => resumeQueue.mutate({ queueName: queue.name })}
                disabled={resumeQueue.isPending}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-2" />
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => pauseQueue.mutate({ queueName: queue.name })}
                disabled={pauseQueue.isPending}
              >
                <Pause className="h-3.5 w-3.5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowJobs(!showJobs)}
            >
              <FileText className="h-3.5 w-3.5 mr-2" />
              Jobs
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Waiting</div>
            <div className="text-sm font-bold text-yellow-600">
              {queue.stats.waiting}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-sm font-bold text-blue-600">
              {queue.stats.active}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-sm font-bold text-green-600">
              {queue.stats.completed}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Failed</div>
            <div className="text-sm font-bold text-red-600">
              {queue.stats.failed}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Delayed</div>
            <div className="text-sm font-bold text-orange-600">
              {queue.stats.delayed}
            </div>
          </div>
        </div>

        {showJobs && (
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <select
                value={jobStatus}
                onChange={(e) =>
                  setJobStatus(
                    e.target.value as
                      | "waiting"
                      | "active"
                      | "completed"
                      | "failed"
                      | "delayed",
                  )
                }
                className="text-xs border rounded px-2 py-1"
              >
                <option value="waiting">Waiting</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
            <QueueJobsList queueName={queue.name} jobs={jobs} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueueJobsList({
  queueName,
  jobs,
}: {
  queueName: string;
  jobs: QueueJobInfo[];
}) {
  const retryJob = useRetryJob();
  const removeJob = useRemoveJob();

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        No jobs found
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="border border-border/50 rounded-lg bg-card/50 p-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">{job.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {job.state}
                </Badge>
                {job.attemptsMade > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Attempts: {job.attemptsMade}
                  </span>
                )}
              </div>
              {job.failedReason && (
                <div className="text-xs text-red-600 mt-1">
                  {job.failedReason}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(job.timestamp), {
                  addSuffix: true,
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {job.state === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => retryJob.mutate({ queueName, jobId: job.id })}
                  disabled={retryJob.isPending}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-red-600"
                onClick={() => removeJob.mutate({ queueName, jobId: job.id })}
                disabled={removeJob.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeadLetterQueueContent() {
  const { data: deadLetterData, isLoading } = useDeadLetterJobs();
  const _retryJob = useRetryJob();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-sm text-muted-foreground text-center">
            Loading dead-letter queue...
          </div>
        </CardContent>
      </Card>
    );
  }

  const jobs = deadLetterData?.jobs || [];
  const stats = deadLetterData?.stats || { total: 0, waiting: 0, active: 0 };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Dead Letter Queue Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold text-red-600">
                {stats.total}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Waiting</div>
              <div className="text-lg font-bold">{stats.waiting}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-lg font-bold">{stats.active}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">No dead-letter jobs</p>
              <p className="text-xs">All jobs are processing successfully.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{job.name}</span>
                      <Badge variant="destructive" className="text-xs">
                        {job.queue}
                      </Badge>
                    </div>
                    <div className="text-xs text-red-600 mb-1">
                      {job.failedReason}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Attempts: {job.attemptsMade} •{" "}
                      {formatDistanceToNow(new Date(job.timestamp), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      // Note: This would need the dead-letter retry endpoint
                      // toast.info("Dead-letter retry not yet implemented");
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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
