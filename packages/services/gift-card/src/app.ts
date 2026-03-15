import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { GiftCardController } from './controllers/gift-card.controller';
import { createGiftCardRouter } from './routes/gift-card.routes';

export interface AppOptions {
  controller: GiftCardController;
  logger: Logger;
}

export function createApp(options: AppOptions): express.Application {
  const { controller, logger } = options;
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/gift-cards/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', service: 'gift-card-service' });
  });

  // Mount gift card routes
  app.use('/gift-cards', createGiftCardRouter(controller));

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}
