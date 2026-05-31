import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message?: string, status = 200) =>
  res.status(status).json({ success: true, data, ...(message ? { message } : {}) });

export const sendError = (res: Response, error: string, status = 400, details?: Record<string, string[]>) =>
  res.status(status).json({ success: false, error, ...(details ? { details } : {}) });

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) =>
  res.status(200).json({
    success: true,
    data,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  });
