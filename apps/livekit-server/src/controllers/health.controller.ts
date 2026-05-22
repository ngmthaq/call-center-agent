import type { RequestHandler } from 'express';
import { getHealthStatus } from '../services/health.service.js';

export const healthController: RequestHandler = (_req, res) => {
  const status = getHealthStatus();
  res.status(200).json(status);
};
