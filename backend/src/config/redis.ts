import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// Dedicated Redis connection for general Redis operations (Rate limiting, locks, caching)
export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully to Redis server');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});
