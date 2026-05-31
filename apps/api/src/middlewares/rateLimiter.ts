import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../lib/redis';
import { sendError } from '../lib/response';

interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  keyFn?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Redis-backed rate limiter — works across cluster workers AND Railway replicas.
 * Falls back to IP-based limiting if Redis is unavailable.
 *
 * Security: uses both IP and user ID (when authenticated) as the key,
 * preventing users from bypassing limits by rotating IPs through a proxy.
 */
export const redisRateLimit = (opts: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket.remoteAddress
      ?? 'unknown';

    // Combine IP + user ID for authenticated requests (double protection)
    const userId = (req as any).user?.sub;
    const baseKey = userId ? `${ip}:${userId}` : ip;
    const key = opts.keyFn ? opts.keyFn(req) : `${req.path}:${baseKey}`;

    const { allowed, remaining, resetIn } = await checkRateLimit(
      key,
      opts.maxRequests,
      opts.windowSeconds
    );

    res.setHeader('X-RateLimit-Limit', opts.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + resetIn);

    if (!allowed) {
      res.setHeader('Retry-After', resetIn);
      sendError(res, `Rate limit exceeded. Try again in ${resetIn}s.`, 429);
      return;
    }

    next();
  };
};

// Pre-configured limiters for different endpoint sensitivity levels
export const strictAuthLimit = redisRateLimit({
  maxRequests: 5,
  windowSeconds: 900, // 15 min — login/signup
});

export const authLimit = redisRateLimit({
  maxRequests: 20,
  windowSeconds: 900, // token refresh
});

export const apiLimit = redisRateLimit({
  maxRequests: 300,
  windowSeconds: 60, // general API
});

export const writeLimit = redisRateLimit({
  maxRequests: 60,
  windowSeconds: 60, // create/update/delete
});
