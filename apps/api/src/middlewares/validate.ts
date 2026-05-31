import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../lib/response';

export const validate =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const flattened = (result.error as ZodError).flatten();
      const details = flattened.fieldErrors as Record<string, string[] | undefined>;
      sendError(res, 'Validation failed', 422, details);
      return;
    }
    req[source] = result.data;
    next();
  };
