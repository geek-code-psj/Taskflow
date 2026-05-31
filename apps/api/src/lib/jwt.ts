import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload } from '@taskflow/types';

const getAccessSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable not set');
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET environment variable not set');
  return secret;
};

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 7;

export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string =>
  jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_EXPIRES });

export const generateRefreshToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
};

export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const verifyAccessToken = (token: string): JWTPayload =>
  jwt.verify(token, getAccessSecret()) as JWTPayload;

export const verifyRefreshToken = (token: string): boolean => {
  try {
    // Refresh tokens are opaque random bytes — no JWT verification needed
    return typeof token === 'string' && token.length === 128;
  } catch {
    return false;
  }
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_EXPIRES_MS = REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
