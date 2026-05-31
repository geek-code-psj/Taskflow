import { Request, Response, NextFunction } from 'express';
import { sendError } from '../lib/response';

/**
 * Recursively sanitizes an object to strip dangerous HTML/script patterns.
 * Defense in depth: Zod validates structure, this strips XSS payloads.
 */
const sanitize = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [sanitize(k), sanitize(v)])
    );
  }
  return value;
};

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) req.body = sanitize(req.body);
  next();
};

/**
 * SQL injection pattern detector — catches attempts that bypass parameterized queries.
 * Parameterized queries are the PRIMARY defense; this is secondary logging/blocking.
 */
const SQL_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(-{2}|\/\*|\*\/)/,
  /\b(OR|AND)\b\s+\d+\s*=\s*\d+/i,
  /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
];

export const detectSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  const check = JSON.stringify({ ...req.body, ...req.query, ...req.params });
  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(check)) {
      console.warn(`[security] SQL injection attempt from ${req.ip}: ${check.substring(0, 200)}`);
      sendError(res, 'Invalid request payload', 400);
      return;
    }
  }
  next();
};

/**
 * Validates Content-Type for mutation endpoints.
 * Prevents form-based CSRF attacks that set wrong content type.
 */
export const requireJSON = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.is('application/json')) {
      sendError(res, 'Content-Type must be application/json', 415);
      return;
    }
  }
  next();
};

/**
 * Request size guard — prevents memory exhaustion attacks.
 */
export const guardRequestSize = (maxBytes: number) =>
  (req: Request, res: Response, next: NextFunction): void => {
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        sendError(res, 'Request payload too large', 413);
        req.destroy();
      }
    });
    next();
  };

/**
 * Adds security-relevant response headers not covered by helmet.
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers; rely on CSP instead
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};
