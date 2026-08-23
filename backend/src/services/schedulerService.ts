import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { addEmailToQueue, emailQueue } from '../queues/emailQueue';
import { emailService } from './emailService';

export interface ScheduleBatchParams {
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date; // Defaults to now
  delayBetweenEmailsMs?: number; // Delay between consecutive recipients
  hourlyLimit?: number;
  senderEmail?: string;
  senderName?: string;
  userId?: string;
}

export interface ScheduleBatchResult {
  batchId: string;
  totalScheduled: number;
  senderEmail: string;
  firstScheduledAt: Date;
  lastScheduledAt: Date;
}

export class SchedulerService {
  /**
   * Schedules a batch of emails across recipients with staggered delivery.
   */
  public async scheduleBatch(params: ScheduleBatchParams): Promise<ScheduleBatchResult> {
    const {
      recipients,
      subject,
      body,
      startTime = new Date(),
      delayBetweenEmailsMs = 2000,
      hourlyLimit = 200,
      senderEmail: providedSender,
      senderName,
      userId,
    } = params;

    const senderEmail = providedSender || emailService.getDefaultSenderEmail();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseStartTime = new Date(startTime).getTime();
    const now = Date.now();

    // Clean and deduplicate recipient emails
    const uniqueRecipients = Array.from(
      new Set(
        recipients
          .map((r) => r.trim().toLowerCase())
          .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
      )
    );

    if (uniqueRecipients.length === 0) {
      throw new Error('No valid recipient email addresses provided');
    }

    const scheduledJobs = [];

    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipient = uniqueRecipients[i];
      // Stagger each recipient by delayBetweenEmailsMs
      const targetTimeMs = Math.max(now, baseStartTime + i * delayBetweenEmailsMs);
      const scheduledAt = new Date(targetTimeMs);
      const delayMs = Math.max(0, targetTimeMs - now);

      // 1. Create DB record first (source of truth)
      const dbJob = await prisma.emailJob.create({
        data: {
          recipient,
          subject,
          body,
          senderEmail,
          scheduledAt,
          status: 'SCHEDULED',
          batchId,
          userId: userId || null,
          minDelayBetweenEmailsMs: delayBetweenEmailsMs,
          hourlyLimitOverride: hourlyLimit,
        },
      });

      // 2. Add to BullMQ with strict idempotency (jobId = dbJob.id)
      const bullmqJobId = await addEmailToQueue(
        {
          dbJobId: dbJob.id,
          recipient,
          subject,
          body,
          senderEmail,
          senderName,
          scheduledAt: scheduledAt.toISOString(),
          minDelayBetweenEmailsMs: delayBetweenEmailsMs,
          hourlyLimitOverride: hourlyLimit,
          batchId,
          userId,
        },
        delayMs
      );

      // 3. Update DB record with BullMQ ID
      await prisma.emailJob.update({
        where: { id: dbJob.id },
        data: { bullmqJobId },
      });

      scheduledJobs.push({ id: dbJob.id, recipient, scheduledAt });
    }

    const firstScheduledAt = scheduledJobs[0].scheduledAt;
    const lastScheduledAt = scheduledJobs[scheduledJobs.length - 1].scheduledAt;

    console.log(
      `[SchedulerService] Scheduled ${scheduledJobs.length} emails for batch ${batchId}. First: ${firstScheduledAt.toISOString()}, Last: ${lastScheduledAt.toISOString()}`
    );

    return {
      batchId,
      totalScheduled: scheduledJobs.length,
      senderEmail,
      firstScheduledAt,
      lastScheduledAt,
    };
  }

  /**
   * Cancels a scheduled email job from both BullMQ and the database.
   */
  public async cancelEmail(jobId: string): Promise<boolean> {
    const jobRecord = await prisma.emailJob.findUnique({
      where: { id: jobId },
    });

    if (!jobRecord) {
      throw new Error(`Email job ${jobId} not found`);
    }

    if (jobRecord.status === 'SENT') {
      throw new Error('Cannot cancel an email that has already been sent');
    }

    // Try to remove from BullMQ
    try {
      const bullJob = await emailQueue.getJob(jobRecord.id);
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (err) {
      console.warn(`[SchedulerService] Warning: Could not remove job ${jobId} from queue directly:`, err);
    }

    // Update status in Database
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
      },
    });

    return true;
  }

  /**
   * Crash Recovery / Server Restart Reconciliation:
   * Checks for any jobs in database that were interrupted or scheduled while server was down.
   */
  public async reconcileOnStartup(): Promise<void> {
    try {
      console.log('[SchedulerService] Running startup job reconciliation...');
      
      // Reset any jobs that were stuck in PROCESSING when server crashed back to SCHEDULED
      const stuckJobs = await prisma.emailJob.updateMany({
        where: { status: 'PROCESSING' },
        data: { status: 'SCHEDULED' },
      });

      if (stuckJobs.count > 0) {
        console.log(`[SchedulerService] Re-queued ${stuckJobs.count} interrupted jobs`);
      }

      console.log('[SchedulerService] Startup reconciliation complete.');
    } catch (error) {
      console.error('[SchedulerService] Error during startup reconciliation:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
