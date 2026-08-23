import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import { emailService } from './services/emailService';
import { schedulerService } from './services/schedulerService';
import { emailWorker } from './workers/emailWorker';
import { emailQueue } from './queues/emailQueue';
import { redisClient } from './config/redis';
import { prisma } from './config/prisma';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Healthcheck Route
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ReachInbox Email Scheduler Service',
    bullmqWorkerActive: !emailWorker.isPaused(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Server] Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Server Initialization
async function startServer() {
  try {
    console.log('---------------------------------------------------------');
    console.log('🚀 Starting ReachInbox Email Job Scheduler Service...');
    console.log('---------------------------------------------------------');

    // 1. Initialize Ethereal fake SMTP transporter
    await emailService.init();

    // 2. Perform crash recovery / startup job reconciliation
    await schedulerService.reconcileOnStartup();

    // 3. Start listening for incoming API requests
    const server = app.listen(PORT, () => {
      console.log(`[Server] 🌐 Server running at http://localhost:${PORT}`);
      console.log(`[Server] 📬 Default Sender: ${emailService.getDefaultSenderEmail()}`);
      console.log(`[Server] ⚙️ Concurrency: ${process.env.WORKER_CONCURRENCY || 5}`);
      console.log(`[Server] ⏱️ Min Send Delay: ${process.env.DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS || 2000}ms`);
      console.log(`[Server] 🛡️ Hourly Rate Limit: ${process.env.DEFAULT_MAX_EMAILS_PER_HOUR || 200}/hr`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        try {
          console.log('[Server] Closing BullMQ Worker & Queue...');
          await emailWorker.close();
          await emailQueue.close();
          console.log('[Server] Disconnecting Redis & Database...');
          await redisClient.quit();
          await prisma.$disconnect();
          console.log('[Server] Clean shutdown finished. Exiting.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during graceful shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
