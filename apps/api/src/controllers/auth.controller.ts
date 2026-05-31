import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../db/pool';
import {
  generateAccessToken, generateRefreshToken, hashRefreshToken,
  cookieOptions, ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_EXPIRES_MS,
} from '../lib/jwt';
import { sendSuccess, sendError } from '../lib/response';
import { User } from '@taskflow/types';

const SALT_ROUNDS = 12;

const issueTokens = async (
  res: Response,
  user: User,
  familyId?: string
) => {
  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    role: user.global_role,
  });

  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();
  const family = familyId ?? uuidv4();

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, hash, family, expiresAt]
  );

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_EXPIRES_MS,
    path: '/api/auth',
  });

  return { user, access_token: accessToken };
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  const existing = await query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rowCount > 0) {
    sendError(res, 'Email or username already in use', 409);
    return;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await query<User>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, global_role, created_at, updated_at`,
    [username, email, password_hash]
  );

  const user = rows[0]!;
  const data = await issueTokens(res, user);
  sendSuccess(res, data, 'Account created successfully', 201);
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const { rows } = await query<User & { password_hash: string }>(
    `SELECT id, username, email, global_role, password_hash, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );

  const user = rows[0];
  // Constant-time comparison to prevent timing attacks
  const validPass = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');

  if (!user || !validPass) {
    sendError(res, 'Invalid email or password', 401);
    return;
  }

  const { password_hash: _, ...safeUser } = user;
  const data = await issueTokens(res, safeUser as User);
  sendSuccess(res, data, 'Login successful');
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE];
  if (!incomingToken) {
    sendError(res, 'Refresh token required', 401);
    return;
  }

  const tokenHash = hashRefreshToken(incomingToken);

  const { rows } = await query<{
    id: string; user_id: string; family: string; is_revoked: boolean; expires_at: string;
  }>(
    `SELECT id, user_id, family, is_revoked, expires_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  const rt = rows[0];

  if (!rt) {
    sendError(res, 'Invalid refresh token', 401);
    return;
  }

  // Token reuse detection — revoke entire family
  if (rt.is_revoked || new Date(rt.expires_at) < new Date()) {
    await query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE family = $1`,
      [rt.family]
    );
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
    sendError(res, 'Token reuse detected. Please log in again.', 401);
    return;
  }

  // Atomically invalidate old token and issue new pair
  await transaction(async (client) => {
    await client.query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE id = $1`,
      [rt.id]
    );

    const { rows: userRows } = await client.query<User>(
      `SELECT id, username, email, global_role, created_at, updated_at
       FROM users WHERE id = $1`,
      [rt.user_id]
    );

    const user = userRows[0]!;
    const data = await issueTokens(res, user, rt.family);
    sendSuccess(res, data);
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE];
  if (incomingToken) {
    const tokenHash = hashRefreshToken(incomingToken);
    await query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, path: '/api/auth' });
  sendSuccess(res, null, 'Logged out successfully');
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const { rows } = await query<User>(
    `SELECT id, username, email, global_role, created_at, updated_at
     FROM users WHERE id = $1`,
    [req.user!.sub]
  );
  if (!rows.length) { sendError(res, 'User not found', 404); return; }
  sendSuccess(res, rows[0]);
};
