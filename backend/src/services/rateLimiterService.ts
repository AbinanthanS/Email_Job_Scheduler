import { redisClient } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  remaining: number;
  delayUntilNextWindowMs?: number;
  nextWindowTimestamp?: number;
}

export class RateLimiterService {
  private defaultMaxPerHour: number;

  constructor() {
    this.defaultMaxPerHour = parseInt(process.env.DEFAULT_MAX_EMAILS_PER_HOUR || '200', 10);
  }

  /**
   * Generates an hourly bucket key string for Redis.
   * Format: YYYY-MM-DD-HH
   */
  private getHourlyWindowKey(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }

  /**
   * Calculates milliseconds remaining until the start of the next hour bucket.
   */
  public getDelayUntilNextHour(date: Date = new Date()): { delayMs: number; nextWindowTimestamp: number } {
    const nextHour = new Date(date);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0); // Beginning of next hour
    const nextWindowTimestamp = nextHour.getTime();
    const delayMs = Math.max(nextWindowTimestamp - date.getTime(), 1000); // minimum 1 second
    return { delayMs, nextWindowTimestamp };
  }

  /**
   * Atomically checks and increments the hourly email rate limit counter in Redis.
   * Safe across multiple worker instances and processes using Redis atomic transactions.
   *
   * @param senderEmail - Sender email address
   * @param limitOverride - Optional custom limit per hour for this sender or job
   */
  public async checkAndConsumeRateLimit(
    senderEmail: string,
    limitOverride?: number
  ): Promise<RateLimitCheckResult> {
    const maxLimit = limitOverride && limitOverride > 0 ? limitOverride : this.defaultMaxPerHour;
    const now = new Date();
    const windowKey = this.getHourlyWindowKey(now);
    const redisKey = `ratelimit:sender:${senderEmail.toLowerCase().trim()}:${windowKey}`;

    // Redis Lua Script for atomic Check-and-Increment with 2-hour TTL
    const luaScript = `
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
    `;

    try {
      const result = (await redisClient.eval(
        luaScript,
        1,
        redisKey,
        maxLimit.toString()
      )) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];
      const remaining = Math.max(0, maxLimit - currentCount);

      if (!allowed) {
        const { delayMs, nextWindowTimestamp } = this.getDelayUntilNextHour(now);
        return {
          allowed: false,
          currentCount,
          maxLimit,
          remaining: 0,
          delayUntilNextWindowMs: delayMs,
          nextWindowTimestamp,
        };
      }

      return {
        allowed: true,
        currentCount,
        maxLimit,
        remaining,
      };
    } catch (error) {
      console.error(`[RateLimiterService] Redis error checking rate limit for ${senderEmail}:`, error);
      // Fail open or fallback to allow dispatch if Redis has temporary glitch
      return {
        allowed: true,
        currentCount: 0,
        maxLimit,
        remaining: maxLimit,
      };
    }
  }

  /**
   * Retrieves current hourly usage statistics for a sender.
   */
  public async getSenderHourlyUsage(senderEmail: string, limitOverride?: number): Promise<{ currentCount: number; maxLimit: number; remaining: number }> {
    const maxLimit = limitOverride && limitOverride > 0 ? limitOverride : this.defaultMaxPerHour;
    const windowKey = this.getHourlyWindowKey(new Date());
    const redisKey = `ratelimit:sender:${senderEmail.toLowerCase().trim()}:${windowKey}`;

    try {
      const current = await redisClient.get(redisKey);
      const currentCount = current ? parseInt(current, 10) : 0;
      return {
        currentCount,
        maxLimit,
        remaining: Math.max(0, maxLimit - currentCount),
      };
    } catch {
      return { currentCount: 0, maxLimit, remaining: maxLimit };
    }
  }
}

export const rateLimiterService = new RateLimiterService();
