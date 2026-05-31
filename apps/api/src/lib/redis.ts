/**
 * redis.ts — Redis client + rate limiter store
 *
 * Why Redis for 10,000+ users:
 * - In-memory rate limit counters would be per-process and inconsistent across cluster workers
 * - Redis gives us a single, atomic counter shared across ALL cluster workers AND Railway replicas
 * - This prevents users from bypassing rate limits by hitting different workers/replicas
 */
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export const getRedisClient = async () => {
  if (!redisClient) {
    if (!process.env.REDIS_URL) {
      console.warn('[redis] REDIS_URL not set — rate limiting will use in-memory store (single-instance only)');
      return null;
    }

    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        connectTimeout: 5000,
      },
    });

    redisClient.on('error', (err) => console.error('[redis] error:', err.message));
    redisClient.on('reconnecting', () => console.log('[redis] reconnecting...'));

    await redisClient.connect();
    console.log('[redis] connected');
  }
  return redisClient;
};

/**
 * Atomic rate limiter using Redis INCR + EXPIRE.
 * Returns { allowed: boolean, remaining: number, resetIn: number }
 *
 * This is more secure than express-rate-limit alone because:
 * 1. Shared across ALL cluster workers (no bypass by hitting different PID)
 * 2. Atomic — no race conditions between check and increment
 * 3. Works across Railway horizontal replicas with shared Redis
 */
export const checkRateLimit = async (
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> => {
  const redis = await getRedisClient();

  if (!redis) {
    // Fallback: allow all (in-memory rate limiter on express handles this)
    return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
  }

  const redisKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);

  // Pipeline: INCR + TTL in a single round trip
  const pipeline = redis.multi();
  pipeline.incr(redisKey);
  pipeline.ttl(redisKey);
  const [count, ttl] = (await pipeline.exec()) as [number, number];

  // Set expiry only on first request in window
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  const resetIn = ttl > 0 ? ttl : windowSeconds;
  const remaining = Math.max(0, maxRequests - count);
  const allowed = count <= maxRequests;

  return { allowed, remaining, resetIn };
};

/**
 * Blacklist a token family (used on refresh token theft detection).
 * All workers check this before issuing new tokens.
 */
export const blacklistTokenFamily = async (family: string, ttlSeconds = 7 * 24 * 3600) => {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.setEx(`blacklist:family:${family}`, ttlSeconds, '1');
};

export const isTokenFamilyBlacklisted = async (family: string): Promise<boolean> => {
  const redis = await getRedisClient();
  if (!redis) return false;
  return (await redis.get(`blacklist:family:${family}`)) === '1';
};
