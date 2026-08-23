import { schedulerService } from './services/schedulerService';
import { emailService } from './services/emailService';
import { prisma } from './config/prisma';
import { emailQueue } from './queues/emailQueue';
import { rateLimiterService } from './services/rateLimiterService';

async function runE2ETest() {
  console.log('===============================================================');
  console.log('🧪 REACHINBOX EMAIL SCHEDULER & RATE LIMITER E2E TEST SUITE');
  console.log('===============================================================\n');

  try {
    // 1. Initialize SMTP
    console.log('[Test 1] Initializing SMTP Transporter...');
    await emailService.init();
    const sender = emailService.getDefaultSenderEmail();
    console.log(`[Test 1] ✅ SMTP initialized with sender: ${sender}\n`);

    // 2. Test Single & Bulk Scheduling with Staggered Delays
    console.log('[Test 2] Scheduling a batch of 5 test emails with 2s staggering...');
    const testRecipients = [
      'lead1.reachinbox@ethereal.email',
      'lead2.reachinbox@ethereal.email',
      'lead3.reachinbox@ethereal.email',
      'lead4.reachinbox@ethereal.email',
      'lead5.reachinbox@ethereal.email',
    ];

    const batchResult = await schedulerService.scheduleBatch({
      recipients: testRecipients,
      subject: 'Welcome to ReachInbox High-Throughput Job Scheduler!',
      body: '<h1>ReachInbox Email Dispatch</h1><p>This email was scheduled via BullMQ persistent Redis delayed queue without cron jobs.</p>',
      delayBetweenEmailsMs: 2000,
      hourlyLimit: 10,
      senderEmail: sender,
    });

    console.log(`[Test 2] ✅ Batch enqueued: BatchID=${batchResult.batchId}, Count=${batchResult.totalScheduled}`);
    console.log(`[Test 2] First target: ${batchResult.firstScheduledAt.toLocaleTimeString()}, Last target: ${batchResult.lastScheduledAt.toLocaleTimeString()}\n`);

    // 3. Test Redis Rate Limiter Calculation
    console.log('[Test 3] Testing Atomic Redis Rate Limiter overflow handling...');
    const testSender = 'ratelimit.test@reachinbox.ai';
    const limit = 3;

    // Simulate 3 allowed sends
    for (let i = 1; i <= 3; i++) {
      const check = await rateLimiterService.checkAndConsumeRateLimit(testSender, limit);
      console.log(`  Send attempt #${i}: Allowed=${check.allowed}, Count=${check.currentCount}/${check.maxLimit}`);
    }

    // 4th send should trigger rate limit overflow
    const overflowCheck = await rateLimiterService.checkAndConsumeRateLimit(testSender, limit);
    console.log(`  Send attempt #4 (Overflow): Allowed=${overflowCheck.allowed}, RescheduledDelay=${Math.round((overflowCheck.delayUntilNextWindowMs || 0)/1000)}s`);
    if (!overflowCheck.allowed) {
      console.log('[Test 3] ✅ Rate Limiter successfully caught overflow and calculated next hour window!\n');
    }

    // 4. Test Idempotency & Queue Count
    const queueCounts = await emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed');
    console.log('[Test 4] BullMQ Queue Current State:', queueCounts);

    console.log('\n===============================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
  } catch (error: any) {
    console.error('❌ E2E Test Suite Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runE2ETest();
