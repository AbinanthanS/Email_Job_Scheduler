import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queues/emailQueue';
import { emailService } from '../services/emailService';
import { rateLimiterService } from '../services/rateLimiterService';
import { prisma } from '../config/prisma';

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const defaultMinDelayMs = parseInt(process.env.DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { dbJobId, senderEmail, senderName, recipient, subject, body, minDelayBetweenEmailsMs, hourlyLimitOverride } =
      job.data;

    console.log(`[EmailWorker] Processing job ${job.id} (DB ID: ${dbJobId}) for recipient: ${recipient}`);

    // Step 1: Check Database record to verify current status (Idempotency check)
    const emailRecord = await prisma.emailJob.findUnique({
      where: { id: dbJobId },
    });

    if (!emailRecord) {
      console.warn(`[EmailWorker] Database record ${dbJobId} not found. Skipping.`);
      return;
    }

    if (emailRecord.status === 'SENT') {
      console.log(`[EmailWorker] Job ${dbJobId} has already been SENT. Preventing duplicate dispatch.`);
      return;
    }

    if (emailRecord.status === 'CANCELLED') {
      console.log(`[EmailWorker] Job ${dbJobId} was CANCELLED by user. Skipping.`);
      return;
    }

    // Step 2: Rate Limit Check (Emails per hour for this sender/global)
    const rateLimitCheck = await rateLimiterService.checkAndConsumeRateLimit(
      senderEmail,
      hourlyLimitOverride || emailRecord.hourlyLimitOverride || undefined
    );

    if (!rateLimitCheck.allowed) {
      const delayMs = rateLimitCheck.delayUntilNextWindowMs || 3600000;
      const nextWindowDate = new Date(rateLimitCheck.nextWindowTimestamp || Date.now() + delayMs);

      console.warn(
        `[EmailWorker] ⚠️ Hourly rate limit reached for sender ${senderEmail} (${rateLimitCheck.currentCount}/${rateLimitCheck.maxLimit}). Rescheduling job ${dbJobId} in ${Math.round(
          delayMs / 1000
        )}s (at ${nextWindowDate.toISOString()})`
      );

      // Update DB to reflect rescheduling
      await prisma.emailJob.update({
        where: { id: dbJobId },
        data: {
          status: 'RESCHEDULED',
          rateLimitDelayedUntil: nextWindowDate,
        },
      });

      // Reschedule into BullMQ without failing the job
      await emailQueue.add('send-email', job.data, {
        delay: delayMs,
        jobId: `rescheduled_${dbJobId}_${Date.now()}`,
      });

      return { rescheduled: true, nextWindow: nextWindowDate };
    }

    // Step 3: Minimum delay between individual emails (Provider Throttling simulation)
    const throttlingDelay = minDelayBetweenEmailsMs ?? emailRecord.minDelayBetweenEmailsMs ?? defaultMinDelayMs;
    if (throttlingDelay > 0) {
      await sleep(throttlingDelay);
    }

    // Step 4: Update status to PROCESSING
    await prisma.emailJob.update({
      where: { id: dbJobId },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
      },
    });

    // Step 5: Send email via fake SMTP (Ethereal)
    try {
      const result = await emailService.sendEmail({
        senderEmail,
        senderName,
        recipient,
        subject,
        body,
      });

      // Step 6: Mark as SENT in Database with Ethereal Preview URL
      await prisma.emailJob.update({
        where: { id: dbJobId },
        data: {
          status: 'SENT',
          executedAt: new Date(),
          etherealUrl: result.etherealPreviewUrl || undefined,
          errorReason: null,
        },
      });

      console.log(`[EmailWorker] ✅ Successfully delivered email to ${recipient}. Preview: ${result.etherealPreviewUrl}`);

      return {
        success: true,
        messageId: result.messageId,
        previewUrl: result.etherealPreviewUrl,
      };
    } catch (error: any) {
      console.error(`[EmailWorker] ❌ Failed to send email ${dbJobId} to ${recipient}:`, error.message);

      // Update DB with failure details
      await prisma.emailJob.update({
        where: { id: dbJobId },
        data: {
          status: 'FAILED',
          errorReason: error.message || 'SMTP dispatch failure',
        },
      });

      throw error; // Allows BullMQ retry policy to handle retries
    }
  },
  {
    connection: redisConfig,
    concurrency,
    limiter: {
      max: 50, // max jobs processed per duration window in BullMQ
      duration: 1000,
    },
  }
);

emailWorker.on('ready', () => {
  console.log(`[EmailWorker] Worker initialized and listening with concurrency: ${concurrency}`);
});

emailWorker.on('error', (err) => {
  console.error('[EmailWorker] Worker error:', err.message);
});
