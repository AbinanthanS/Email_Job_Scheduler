import { Queue, QueueEvents } from 'bullmq';
import { redisConfig } from '../config/redis';

export interface EmailJobData {
  dbJobId: string;
  senderEmail: string;
  senderName?: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  minDelayBetweenEmailsMs?: number;
  hourlyLimitOverride?: number;
  batchId?: string;
  userId?: string;
}

export const EMAIL_QUEUE_NAME = 'reachinbox-email-dispatch-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Retain for 24h
      count: 10000,
    },
    removeOnFail: {
      age: 72 * 3600, // Retain for 72h
      count: 5000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
});

emailQueueEvents.on('completed', ({ jobId }) => {
  console.log(`[BullMQ] Job ${jobId} completed successfully`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[BullMQ] Job ${jobId} failed. Reason: ${failedReason}`);
});

/**
 * Adds a delayed email job into BullMQ backed by Redis.
 * Idempotency is enforced by using the database record ID as the BullMQ jobId.
 */
export async function addEmailToQueue(data: EmailJobData, delayMs: number): Promise<string> {
  const safeDelay = Math.max(0, Math.round(delayMs));
  const job = await emailQueue.add('send-email', data, {
    delay: safeDelay,
    jobId: data.dbJobId, // Guarantees idempotency
  });

  return job.id as string;
}
