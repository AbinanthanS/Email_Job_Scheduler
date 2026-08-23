# ReachInbox High-Throughput Email Scheduler & Dashboard

A production-grade, distributed email scheduling service and modern dashboard engineered with **TypeScript**, **Express.js**, **BullMQ + Redis**, **PostgreSQL / Prisma ORM**, **Ethereal fake SMTP**, and **React 18 + Tailwind CSS**.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    A[Frontend Dashboard<br/>React + Tailwind + Vite] -->|REST API + JWT| B[Express.js API Server]
    B -->|Persist Metadata| C[(PostgreSQL Database<br/>Prisma ORM)]
    B -->|Delayed Job Enqueue| D[(Redis 7<br/>BullMQ Delayed Queue)]
    
    subgraph BullMQ Worker Pool [BullMQ Distributed Worker Pool]
        W1[Worker Instance 1]
        W2[Worker Instance 2]
        W3[Worker Instance N]
    end
    
    D -->|Pop Due Jobs at target timestamp| BullMQ Worker Pool
    BullMQ Worker Pool -->|Atomic Check & Increment| R[(Redis Rate Limiter<br/>Lua Script)]
    
    R -->|Limit Exceeded| ReQ[Auto-Reschedule into Next Hour Window]
    ReQ --> D
    
    R -->|Allowed & Throttled| S[Ethereal SMTP Dispatcher<br/>Nodemailer Transporter Pool]
    S -->|Delivery Success + Preview URL| C
    S -->|Render Web Inbox| E[Ethereal Web Inbox Viewer]
```

---

## 🚀 Key Features & Architectural Highlights

### 1. No Cron Jobs — Pure BullMQ Persistent Delayed Queues
- **Why No Cron?** Traditional cron pollers (e.g. `node-cron`, `crontab`) poll the database at fixed intervals (e.g. every minute), causing database locking, scalability bottlenecks, race conditions across multiple instances, and latency spikes.
- **BullMQ Architecture**: We utilize Redis native Sorted Sets (`ZSET`) where delayed jobs are scored by their target execution Unix timestamp (`targetTimestampMs`). Redis natively pops jobs at the exact millisecond they are due.
- **Strict Idempotency**: Each job is registered with `jobId = emailJob.id` (PostgreSQL CUID/UUID). If a duplicate request or network retry occurs, BullMQ deduplicates it at the Redis level.

### 2. Configurable Worker Concurrency
- Configured via `WORKER_CONCURRENCY` in `.env` (default `5` concurrent workers per process).
- Multiple workers can run across multiple server instances in a distributed cluster without race conditions or job duplication.

### 3. Provider Throttling (Minimum Delay Between Sends)
- Configurable via `DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS` (default: **2000ms / 2 seconds** between sends).
- Simulates real-world email deliverability warmup and provider throttling to prevent IP rate-limiting or domain reputation penalties.

### 4. Distributed Hourly Rate Limiter & Non-Dropping Rescheduling
- **Redis Atomic Key**: `ratelimit:sender:<senderEmail>:<YYYY-MM-DD-HH>`
- **Lua Script Atomic Check & Increment**:
  ```lua
  local current = redis.call('GET', KEYS[1])
  if current and tonumber(current) >= tonumber(ARGV[1]) then
    return {0, tonumber(current)}
  else
    local newCount = redis.call('INCR', KEYS[1])
    if newCount == 1 then
      redis.call('EXPIRE', KEYS[1], 7200)
    end
    return {1, newCount}
  end
  ```
- **Behavior Under Heavy Load (1000+ Emails)**:
  - If 1,000 emails are scheduled simultaneously and exceed the sender's hourly limit (e.g. 200/hr):
  - **No jobs are dropped or marked failed.**
  - The worker calculates the exact millisecond offset until the start of the next hour window (`nextHourStartMs - Date.now()`).
  - The job status in PostgreSQL is updated to `RESCHEDULED`, and BullMQ pushes the delayed job into the next hour window while preserving order.

### 5. Crash Resilience & Server Restart Recovery
- If the backend server or worker pool crashes or restarts:
  - BullMQ persistent Redis sorted sets retain all future scheduled jobs.
  - On application startup, `schedulerService.reconcileOnStartup()` runs an automated reconciliation query to reconcile any in-flight jobs and ensure zero dropped deliveries.

### 6. Fake SMTP (Ethereal Email) with Live Web Preview
- Uses Nodemailer with automatic dynamic Ethereal test account generation on first launch.
- Dispatched emails generate a clickable `nodemailer.getTestMessageUrl(info)` link saved in the database, allowing users to view formatted rendered HTML emails directly in their browser.

### 7. Modern Frontend Dashboard
- Built with **React 18**, **TypeScript**, **Tailwind CSS**, and **Lucide Icons**.
- Real **Google OAuth 2.0** login via `@react-oauth/google` with 1-Click Demo Login fallback.
- Drag & Drop **CSV / TXT Lead Parser** (detects and deduplicates emails on the fly).
- Live **Queue Health & Rate Limiter Monitor**.
- Searchable **Scheduled Emails** & **Sent Emails** tables with direct Ethereal view links.
- 4-second live auto-refresh polling.

---

## 📦 Project Structure

```
Email_Job_Scheduler/
├── docker-compose.yml              # Redis 7 & PostgreSQL 16 containers
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # PostgreSQL schema (User, EmailJob, SenderProfile)
│   │   └── schema.sqlite.prisma    # SQLite fallback schema
│   ├── src/
│   │   ├── config/                 # Redis connection & Prisma client
│   │   ├── controllers/            # Auth, Email, Analytics controllers
│   │   ├── middleware/             # Auth JWT verification
│   │   ├── queues/                 # BullMQ queue definition & events
│   │   ├── workers/                # BullMQ email worker & concurrency logic
│   │   ├── services/               # SMTP service, Rate limiter, Scheduler
│   │   ├── routes/                 # Express REST API routes
│   │   ├── test-scheduler.ts       # E2E test script
│   │   └── server.ts               # Server entry & graceful shutdown
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/             # Navbar, StatCards, ComposeModal, ScheduledTable, SentTable, QueueHealthDrawer
    │   ├── context/                # AuthContext, ToastContext
    │   ├── pages/                  # DashboardPage, LoginPage
    │   ├── services/               # Axios API client
    │   ├── types/                  # TypeScript interfaces
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css               # Tailwind CSS & Glassmorphism design tokens
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## 🛠️ Setup & Running

### Prerequisites
- **Node.js**: v18+ (tested on Node 24.9)
- **Docker Desktop** (or local Redis + PostgreSQL)

---

### Step 1: Start Redis & PostgreSQL with Docker

```bash
docker compose up -d
```

*(This starts `reachinbox_redis` on port `6379` and `reachinbox_postgres` on port `5432` with health checks).*

---

### Step 2: Configure & Start Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Review `.env` configuration (default values are already pre-filled for local development):
   ```ini
   PORT=5000
   DATABASE_URL="postgresql://reachinbox_user:reachinbox_password@localhost:5432/reachinbox_db?schema=public"
   REDIS_HOST=localhost
   REDIS_PORT=6379
   WORKER_CONCURRENCY=5
   DEFAULT_MIN_DELAY_BETWEEN_EMAILS_MS=2000
   DEFAULT_MAX_EMAILS_PER_HOUR=200
   JWT_SECRET=reachinbox_super_secure_jwt_secret_key_2026
   ```

3. Push the database schema:
   ```bash
   npx prisma db push
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   ```

---

### Step 3: Start Frontend

1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Automated E2E Tests

To run the automated scheduler, BullMQ queue, and Redis rate-limiting integration test suite:

```bash
cd backend
npx ts-node src/test-scheduler.ts
```

---

## 📡 API Reference

### 1. Auth APIs
- `POST /api/auth/google` - Authenticate with Google ID token credential
- `POST /api/auth/demo` - 1-Click Demo login for local testing
- `GET /api/auth/me` - Fetch authenticated user profile

### 2. Email Scheduling APIs
- `POST /api/emails/schedule` - Schedule a batch of leads
  ```json
  {
    "recipients": ["lead1@example.com", "lead2@example.com"],
    "subject": "Exclusive ReachInbox Demo",
    "body": "Hi there, check out our new scheduler!",
    "startTime": "2026-08-23T15:00:00Z",
    "delayBetweenEmails": 2,
    "hourlyLimit": 200,
    "senderName": "ReachInbox Team"
  }
  ```
- `GET /api/emails/scheduled?search=&page=1&limit=20` - Retrieve scheduled queue
- `GET /api/emails/sent?search=&page=1&limit=20` - Retrieve sent emails with Ethereal preview links
- `DELETE /api/emails/:id` - Cancel a scheduled email job
- `GET /api/emails/stats` - BullMQ queue counts and hourly rate limit consumption
- `GET /api/emails/senders` - List sender profiles

---

## 🛡️ License
MIT © ReachInbox Engineering
