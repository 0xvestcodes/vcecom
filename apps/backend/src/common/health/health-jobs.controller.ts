import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BackgroundJobsService } from "../../modules/admin/services/background-jobs.service";
import { Public } from "../decorators/public.decorator";

@ApiTags("admin")
@Controller("_health")
@Public()
export class HealthJobsController {
  constructor(private readonly jobsService: BackgroundJobsService) {}

  @Get("jobs")
  @ApiOperation({
    summary: "Background jobs health check",
    description:
      "Returns status of all background jobs including last execution time, success/failure counts, and overall health",
  })
  @ApiResponse({
    status: 200,
    description: "Jobs health status",
  })
  async getJobsHealth() {
    const jobs = await this.jobsService.getAllJobs();

    // Calculate overall health status
    const now = new Date();
    const unhealthyJobs = jobs.filter((job) => {
      // Check if job hasn't run in expected timeframe
      if (!job.lastRun) {
        return false; // New job, not unhealthy yet
      }

      const lastRunAge = now.getTime() - job.lastRun.getTime();

      // Determine expected interval based on schedule
      let expectedInterval = 24 * 60 * 60 * 1000; // Default 24 hours
      if (job.schedule.includes("*/7")) {
        expectedInterval = 7 * 60 * 1000; // 7 minutes
      } else if (job.schedule.includes("*/10")) {
        expectedInterval = 10 * 60 * 1000; // 10 minutes
      } else if (job.schedule.includes("0 3")) {
        expectedInterval = 24 * 60 * 60 * 1000; // 24 hours
      }

      // Job is unhealthy if:
      // 1. Currently running but took too long (> 30 minutes)
      // 2. Failed last execution
      // 3. Hasn't run in 2x expected interval
      if (job.status === "running") {
        const runningDuration = job.lastDuration || 0;
        return runningDuration > 30 * 60 * 1000; // 30 minutes
      }

      if (job.lastError) {
        return true; // Last execution failed
      }

      return lastRunAge > expectedInterval * 2; // 2x expected interval
    });

    const overallStatus =
      unhealthyJobs.length === 0
        ? "OK"
        : unhealthyJobs.length === jobs.length
          ? "ERROR"
          : "DEGRADED";

    return {
      status: overallStatus,
      totalJobs: jobs.length,
      healthyJobs: jobs.length - unhealthyJobs.length,
      unhealthyJobs: unhealthyJobs.length,
      jobs: jobs.map((job) => ({
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        status: job.status,
        lastRun: job.lastRun?.toISOString(),
        lastDuration: job.lastDuration,
        lastError: job.lastError,
        executionCount: job.executionCount,
        successCount: job.successCount,
        failureCount: job.failureCount,
        health: job.lastError
          ? "ERROR"
          : job.status === "running" && (job.lastDuration || 0) > 30 * 60 * 1000
            ? "DEGRADED"
            : "OK",
      })),
      timestamp: new Date().toISOString(),
    };
  }
}
