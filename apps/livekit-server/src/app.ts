import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/error-handler.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import { rateLimitHandler } from './middlewares/rate-limit.middleware';
import router from './routes';
import webhookRouter from './routes/webhook.route';

export const createApp = (): Express => {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use('/webhook', webhookRouter);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(rateLimitHandler, router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
