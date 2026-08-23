export type EmailJobStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'RESCHEDULED';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface EmailJob {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledAt: string;
  executedAt?: string | null;
  status: EmailJobStatus;
  bullmqJobId?: string | null;
  batchId?: string | null;
  etherealUrl?: string | null;
  errorReason?: string | null;
  attemptCount: number;
  rateLimitDelayedUntil?: string | null;
  minDelayBetweenEmailsMs?: number;
  hourlyLimitOverride?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SenderProfile {
  id: string;
  email: string;
  name: string;
  isDefault?: boolean;
  maxPerHour?: number;
  minDelayMs?: number;
}

export interface SchedulePayload {
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmails?: number; // seconds
  hourlyLimit?: number;
  senderEmail?: string;
  senderName?: string;
}

export interface QueueStats {
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
  db: {
    scheduled: number;
    sent: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  rateLimit: {
    sender: string;
    usedThisHour: number;
    maxPerHour: number;
    remainingThisHour: number;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
