import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { RATE_LIMIT_PRESETS } from "../../common/rate-limiting/rate-limit.config";
import { DiscountWarmupWorker } from "../discounts/services/discount-warmup-worker.service";
import { PricingWarmupWorker } from "../pricing/services/pricing-warmup-worker.service";
import { MediaConsistencyWorker } from "../products/services/media-consistency-worker.service";
import { QueueService } from "../queue/queue.service";
import { InventoryRecoveryService } from "../redis-store/services/inventory-recovery.service";
import {
  JobHistoryResponseDto,
  JobsListResponseDto,
} from "./dto/background-jobs.dto";
import { BackgroundJobsService } from "./services/background-jobs.service";
import { QueueMonitoringService } from "./services/queue-monitoring.service";

@ApiTags("admin")
@Controller("admin/jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class AdminJobsController {
  constructor(
    private readonly jobsService: BackgroundJobsService,
    private readonly queueMonitoringService: QueueMonitoringService,
    private readonly queueService: QueueService,
    // Inject job services for manual triggering
    private readonly inventoryRecoveryService: InventoryRecoveryService,
    private readonly mediaConsistencyWorker: MediaConsistencyWorker,
    private readonly discountWarmupWorker: DiscountWarmupWorker,
    private readonly pricingWarmupWorker: PricingWarmupWorker,
  ) {}

  @Get()
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all background jobs",
    description:
      "Returns a list of all background jobs with their current status, last run time, and execution statistics.",
  })
  @ApiResponse({
    status: 200,
    description: "List of background jobs",
    type: JobsListResponseDto,
  })
  async getAllJobs(): Promise<JobsListResponseDto> {
    const jobs = await this.jobsService.getAllJobs();
    return { jobs };
  }

  @Get(":jobName/history")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get execution history for a job",
    description:
      "Returns execution history for a specific background job, including start/end times, duration, and status.",
  })
  @ApiParam({
    name: "jobName",
    description: "Job name",
    example: "inventory-reconciliation",
  })
  @ApiResponse({
    status: 200,
    description: "Job execution history",
    type: JobHistoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Job not found",
  })
  async getJobHistory(
    @Param("jobName") jobName: string,
  ): Promise<JobHistoryResponseDto> {
    const history = await this.jobsService.getJobHistory(jobName);
    return {
      jobName,
      history,
    };
  }

  @Post(":jobName/trigger")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Manually trigger a background job",
    description:
      "Manually trigger a background job execution. This is useful for testing or immediate execution.",
  })
  @ApiParam({
    name: "jobName",
    description: "Job name",
    example: "inventory-reconciliation",
  })
  @ApiResponse({
    status: 200,
    description: "Job triggered successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Job triggered successfully",
        },
        jobName: {
          type: "string",
          example: "inventory-reconciliation",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (job not found or cannot be triggered)",
  })
  async triggerJob(@Param("jobName") jobName: string) {
    // Validate job name
    const validJobs = [
      "inventory-reconciliation",
      "media-consistency-maintenance",
      "discount-warmup",
      "pricing-warmup",
    ];

    if (!validJobs.includes(jobName)) {
      throw new BadRequestException(
        `Invalid job name. Valid jobs: ${validJobs.join(", ")}`,
      );
    }

    // Record job start
    await this.jobsService.recordJobStart(jobName);

    try {
      // Trigger the actual job based on job name
      switch (jobName) {
        case "inventory-reconciliation":
          await this.inventoryRecoveryService.handleReconciliation();
          break;
        case "media-consistency-maintenance":
          await this.mediaConsistencyWorker.handleNightlyMaintenance();
          break;
        case "discount-warmup":
          await this.discountWarmupWorker.warmup();
          break;
        case "pricing-warmup":
          await this.pricingWarmupWorker.warmup();
          break;
        default:
          throw new BadRequestException(`Unknown job: ${jobName}`);
      }

      // Record successful completion
      await this.jobsService.recordJobCompletion(jobName, true);

      return {
        message: "Job triggered and executed successfully",
        jobName,
      };
    } catch (error) {
      // Record failure
      await this.jobsService.recordJobCompletion(
        jobName,
        false,
        error instanceof Error ? error.message : "Unknown error",
      );

      throw error;
    }
  }

  @Get("queues")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get all queues with statistics",
    description:
      "Returns a list of all registered queues with their current statistics.",
  })
  @ApiResponse({
    status: 200,
    description: "List of queues with statistics",
  })
  async getAllQueues() {
    const queues = await this.queueMonitoringService.getAllQueues();
    return { queues };
  }

  @Get("queues/metrics")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get overall queue metrics",
    description: "Returns aggregated metrics across all queues.",
  })
  @ApiResponse({
    status: 200,
    description: "Queue metrics",
  })
  async getQueueMetrics() {
    return this.queueMonitoringService.getQueueMetrics();
  }

  @Get("queues/:queueName")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get queue details",
    description: "Returns detailed information about a specific queue.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiResponse({
    status: 200,
    description: "Queue details",
  })
  @ApiResponse({
    status: 404,
    description: "Queue not found",
  })
  async getQueueDetails(@Param("queueName") queueName: string) {
    const queue = await this.queueMonitoringService.getQueueDetails(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue '${queueName}' not found`);
    }
    return queue;
  }

  @Get("queues/:queueName/jobs")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get jobs from a queue",
    description: "Returns jobs from a queue with a specific status.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiQuery({
    name: "status",
    enum: ["waiting", "active", "completed", "failed", "delayed"],
    required: false,
    description: "Job status filter",
  })
  @ApiQuery({
    name: "start",
    type: Number,
    required: false,
    description: "Start index (default: 0)",
  })
  @ApiQuery({
    name: "end",
    type: Number,
    required: false,
    description: "End index (default: 50)",
  })
  @ApiResponse({
    status: 200,
    description: "List of jobs",
  })
  async getQueueJobs(
    @Param("queueName") queueName: string,
    @Query("status")
    status:
      | "waiting"
      | "active"
      | "completed"
      | "failed"
      | "delayed" = "waiting",
    @Query("start") start: string = "0",
    @Query("end") end: string = "50",
  ) {
    const jobs = await this.queueMonitoringService.getQueueJobs(
      queueName,
      status,
      parseInt(start, 10),
      parseInt(end, 10),
    );
    return { queueName, status, jobs };
  }

  @Get("queues/:queueName/jobs/:jobId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get job details",
    description: "Returns detailed information about a specific job.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiParam({
    name: "jobId",
    description: "Job ID",
    example: "123",
  })
  @ApiResponse({
    status: 200,
    description: "Job details",
  })
  @ApiResponse({
    status: 404,
    description: "Job not found",
  })
  async getJobDetails(
    @Param("queueName") queueName: string,
    @Param("jobId") jobId: string,
  ) {
    const job = await this.queueMonitoringService.getJobDetails(
      queueName,
      jobId,
    );
    if (!job) {
      throw new NotFoundException(
        `Job '${jobId}' not found in queue '${queueName}'`,
      );
    }
    return job;
  }

  @Get("dead-letter")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_GET)
  @ApiOperation({
    summary: "Get dead-letter queue jobs",
    description: "Returns jobs from the dead-letter queue.",
  })
  @ApiQuery({
    name: "start",
    type: Number,
    required: false,
    description: "Start index (default: 0)",
  })
  @ApiQuery({
    name: "end",
    type: Number,
    required: false,
    description: "End index (default: 50)",
  })
  @ApiResponse({
    status: 200,
    description: "List of dead-letter jobs",
  })
  async getDeadLetterJobs(
    @Query("start") start: string = "0",
    @Query("end") end: string = "50",
  ) {
    const jobs = await this.queueMonitoringService.getDeadLetterJobs(
      parseInt(start, 10),
      parseInt(end, 10),
    );
    const stats = await this.queueMonitoringService.getDeadLetterStats();
    return { jobs, stats };
  }

  @Post("queues/:queueName/jobs/:jobId/retry")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Retry a failed job",
    description: "Retries a failed job from a queue.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiParam({
    name: "jobId",
    description: "Job ID",
    example: "123",
  })
  @ApiResponse({
    status: 200,
    description: "Job retried successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Job not found",
  })
  async retryJob(
    @Param("queueName") queueName: string,
    @Param("jobId") jobId: string,
  ) {
    await this.queueService.retryJob(queueName, jobId);
    return {
      message: "Job retried successfully",
      queueName,
      jobId,
    };
  }

  @Post("dead-letter/:jobId/retry")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Retry a dead-letter job",
    description: "Retries a job from the dead-letter queue.",
  })
  @ApiParam({
    name: "jobId",
    description: "Dead-letter job ID",
    example: "dlq:pricing-warmup:123",
  })
  @ApiResponse({
    status: 200,
    description: "Dead-letter job retried successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Job not found",
  })
  async retryDeadLetterJob(@Param("jobId") jobId: string) {
    // We need to inject this properly, but for now we'll use the queueService
    // In a real implementation, we'd inject DeadLetterQueueService
    throw new BadRequestException(
      "Dead-letter retry not yet implemented via controller",
    );
  }

  @Post("queues/:queueName/pause")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Pause a queue",
    description: "Pauses processing of jobs in a queue.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiResponse({
    status: 200,
    description: "Queue paused successfully",
  })
  async pauseQueue(@Param("queueName") queueName: string) {
    await this.queueService.pauseQueue(queueName);
    return {
      message: "Queue paused successfully",
      queueName,
    };
  }

  @Post("queues/:queueName/resume")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Resume a queue",
    description: "Resumes processing of jobs in a queue.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiResponse({
    status: 200,
    description: "Queue resumed successfully",
  })
  async resumeQueue(@Param("queueName") queueName: string) {
    await this.queueService.resumeQueue(queueName);
    return {
      message: "Queue resumed successfully",
      queueName,
    };
  }

  @Delete("queues/:queueName/jobs/:jobId")
  @RateLimit(RATE_LIMIT_PRESETS.ADMIN_MUTATE)
  @ApiOperation({
    summary: "Remove a job from a queue",
    description: "Removes a job from a queue.",
  })
  @ApiParam({
    name: "queueName",
    description: "Queue name",
    example: "pricing-warmup",
  })
  @ApiParam({
    name: "jobId",
    description: "Job ID",
    example: "123",
  })
  @ApiResponse({
    status: 200,
    description: "Job removed successfully",
  })
  async removeJob(
    @Param("queueName") queueName: string,
    @Param("jobId") jobId: string,
  ) {
    await this.queueService.removeJob(queueName, jobId);
    return {
      message: "Job removed successfully",
      queueName,
      jobId,
    };
  }
}
