import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import createHttpError from 'http-errors';
import { loadConfig } from '../configs/env';

export const rateLimitHandler: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => loadConfig().NODE_ENV === 'development',
  handler: (_req, _res, next) => {
    next(createHttpError(429, 'Too Many Requests'));
  },
});
