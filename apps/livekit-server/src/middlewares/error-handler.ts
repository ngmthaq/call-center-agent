import type { ErrorRequestHandler } from 'express';
import createHttpError, { isHttpError } from 'http-errors';
import { config } from '../config/env.js';

interface ErrorResponseBody {
  status: number;
  message: string;
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError = isHttpError(err) ? err : createHttpError(500, normalizeMessage(err));

  const body: ErrorResponseBody = {
    status: httpError.status,
    message: httpError.message,
  };

  if (config.nodeEnv !== 'production' && httpError.stack !== undefined) {
    body.stack = httpError.stack;
  }

  res.status(httpError.status).json(body);
};

const normalizeMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Internal Server Error';
};
