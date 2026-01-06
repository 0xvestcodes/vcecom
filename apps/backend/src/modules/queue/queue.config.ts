import { QueueOptions } from "bullmq";

/**
 * Default queue configuration (without connection, which is provided at runtime)
 */
export const defaultQueueConfig: Omit<QueueOptions, "connection"> = {
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_DEFAULT_RETRY_ATTEMPTS || "3", 10),
    backoff: {
      type: "exponential",
      delay: parseInt(process.env.QUEUE_DEFAULT_BACKOFF_DELAY || "1000", 10),
    },
    removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE === "true" || {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL === "true" || {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      count: 5000, // Keep last 5000 failed jobs
    },
  },
};

/**
 * Worker configuration
 */
export const workerConfig = {
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "5", 10),
  limiter: {
    max: 10, // Maximum number of jobs to process
    duration: 1000, // Per duration in milliseconds
  },
};

/**
 * Dead-letter queue configuration
 */
export const deadLetterQueueConfig = {
  maxRetries: parseInt(process.env.QUEUE_DEFAULT_RETRY_ATTEMPTS || "3", 10),
  queueName: "dead-letter",
};
