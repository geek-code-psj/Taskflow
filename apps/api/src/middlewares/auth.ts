import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, ACCESS_COOKIE } from '../lib/jwt';
import { sendError } from '../lib/response';
import { JWTPayload } from '@taskflow/types';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.[ACCESS_COOKIE] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
};

export const requireGlobalAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    sendError(res, 'Global admin access required', 403);
    return;
  }
  next();
};
