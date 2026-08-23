import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { schedulerService } from '../services/schedulerService';
import { emailQueue } from '../queues/emailQueue';
import { rateLimiterService } from '../services/rateLimiterService';
import { emailService } from '../services/emailService';

export class EmailController {
  /**
   * Schedules a new email or batch of emails.
   */
  public static async scheduleEmail(req: Request, res: Response): Promise<void> {
    try {
      const {
        recipients,
        subject,
        body,
        startTime,
        delayBetweenEmails, // in seconds or ms
        hourlyLimit,
        senderEmail,
        senderName,
      } = req.body;

      if (!subject || !body) {
        res.status(400).json({ success: false, message: 'Subject and Body are required fields.' });
        return;
      }

      let recipientList: string[] = [];

      if (Array.isArray(recipients)) {
        recipientList = recipients;
      } else if (typeof recipients === 'string') {
        recipientList = recipients.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      }

      if (recipientList.length === 0) {
        res.status(400).json({ success: false, message: 'At least one valid recipient email is required.' });
        return;
      }

      // Convert delay to milliseconds (frontend might pass seconds or milliseconds)
      let delayMs = 2000;
      if (typeof delayBetweenEmails === 'number') {
        delayMs = delayBetweenEmails < 100 ? delayBetweenEmails * 1000 : delayBetweenEmails;
      }

      const limit = parseInt(hourlyLimit, 10) || 200;
      const parsedStartTime = startTime ? new Date(startTime) : new Date();

      const result = await schedulerService.scheduleBatch({
        recipients: recipientList,
        subject,
        body,
        startTime: parsedStartTime,
        delayBetweenEmailsMs: delayMs,
        hourlyLimit: limit,
        senderEmail,
        senderName,
        userId: req.user?.id,
      });

      res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.totalScheduled} email(s).`,
        data: result,
      });
    } catch (error: any) {
      console.error('[EmailController] Error scheduling email batch:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to schedule emails' });
    }
  }

  /**
   * Retrieves paginated list of scheduled emails.
   */
  public static async getScheduledEmails(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = (req.query.search as string) || '';
      const statusFilter = (req.query.status as string) || '';

      const whereClause: any = {
        status: { in: ['SCHEDULED', 'PROCESSING', 'RESCHEDULED'] },
      };

      if (statusFilter && ['SCHEDULED', 'PROCESSING', 'RESCHEDULED'].includes(statusFilter)) {
        whereClause.status = statusFilter;
      }

      if (search) {
        whereClause.OR = [
          { recipient: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { senderEmail: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error: any) {
      console.error('[EmailController] Error fetching scheduled emails:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve scheduled emails' });
    }
  }

  /**
   * Retrieves paginated list of sent/delivered or failed emails.
   */
  public static async getSentEmails(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = (req.query.search as string) || '';
      const statusFilter = (req.query.status as string) || '';

      const whereClause: any = {
        status: { in: ['SENT', 'FAILED'] },
      };

      if (statusFilter && ['SENT', 'FAILED'].includes(statusFilter)) {
        whereClause.status = statusFilter;
      }

      if (search) {
        whereClause.OR = [
          { recipient: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { senderEmail: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          orderBy: { executedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error: any) {
      console.error('[EmailController] Error fetching sent emails:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve sent emails' });
    }
  }

  /**
   * Cancels a scheduled email job.
   */
  public static async cancelEmail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await schedulerService.cancelEmail(id);
      res.status(200).json({ success: true, message: 'Email cancelled successfully' });
    } catch (error: any) {
      console.error('[EmailController] Cancel Error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to cancel email' });
    }
  }

  /**
   * Analytics & Queue Health Stats.
   */
  public static async getStats(req: Request, res: Response): Promise<void> {
    try {
      // BullMQ Queue counts
      let queueCounts = { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 };
      try {
        const counts = await emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
        queueCounts = counts as any;
      } catch (err) {
        // Fallback if Redis is connecting
      }

      // Database counts
      const [scheduledCount, sentCount, failedCount, cancelledCount] = await Promise.all([
        prisma.emailJob.count({ where: { status: { in: ['SCHEDULED', 'RESCHEDULED', 'PROCESSING'] } } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
        prisma.emailJob.count({ where: { status: 'CANCELLED' } }),
      ]);

      // Hourly Rate Limit usage
      const defaultSender = emailService.getDefaultSenderEmail();
      const rateLimitUsage = await rateLimiterService.getSenderHourlyUsage(defaultSender);

      res.status(200).json({
        success: true,
        stats: {
          queue: queueCounts,
          db: {
            scheduled: scheduledCount,
            sent: sentCount,
            failed: failedCount,
            cancelled: cancelledCount,
            total: scheduledCount + sentCount + failedCount + cancelledCount,
          },
          rateLimit: {
            sender: defaultSender,
            usedThisHour: rateLimitUsage.currentCount,
            maxPerHour: rateLimitUsage.maxLimit,
            remainingThisHour: rateLimitUsage.remaining,
          },
        },
      });
    } catch (error: any) {
      console.error('[EmailController] Stats Error:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve stats' });
    }
  }

  /**
   * Returns list of configured sender profiles.
   */
  public static async getSenders(req: Request, res: Response): Promise<void> {
    try {
      const senders = await prisma.senderProfile.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isDefault: true,
          maxPerHour: true,
          minDelayMs: true,
          createdAt: true,
        },
      });

      const defaultEmail = emailService.getDefaultSenderEmail();

      res.status(200).json({
        success: true,
        defaultSenderEmail: defaultEmail,
        senders: senders.length > 0 ? senders : [{ id: 'default', email: defaultEmail, name: 'Default Ethereal Account', isDefault: true }],
      });
    } catch (error: any) {
      res.status(200).json({
        success: true,
        defaultSenderEmail: emailService.getDefaultSenderEmail(),
        senders: [{ id: 'default', email: emailService.getDefaultSenderEmail(), name: 'Default Ethereal Account', isDefault: true }],
      });
    }
  }
}
