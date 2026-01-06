"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useImportJob } from "@/hooks/imports/use-import-job";

interface ImportStatusProps {
  jobId: string;
}

export function ImportStatus({ jobId }: ImportStatusProps) {
  const { data: job, isLoading } = useImportJob(jobId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Import job not found</p>
        </CardContent>
      </Card>
    );
  }

  const progress =
    job.totalRows > 0 ? (job.processedRows / job.totalRows) * 100 : 0;
  const _successRate =
    job.processedRows > 0 ? (job.successfulRows / job.processedRows) * 100 : 0;

  const getStatusIcon = () => {
    switch (job.status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Import Status: {job.status}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>
              {job.processedRows} / {job.totalRows} rows
            </span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Successful</p>
            <p className="text-2xl font-bold text-green-600">
              {job.successfulRows}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600">{job.failedRows}</p>
          </div>
        </div>

        {job.errorCount > 0 && (
          <div>
            <p className="text-sm text-muted-foreground">
              Total Errors: {job.errorCount}
            </p>
          </div>
        )}

        {job.completedAt && (
          <div>
            <p className="text-sm text-muted-foreground">
              Completed: {new Date(job.completedAt).toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
