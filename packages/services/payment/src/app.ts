import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { PaymentController } from './controllers/payment.controller';
import { createPaymentRouter } from './routes/payment.routes';

export interface AppOptions {
  controller: PaymentController;
  logger: Logger;
}

export function createApp(options: AppOptions): express.Application {
  const { controller, logger } = options;
  const app = express();

  // Webhook endpoint needs raw body for signature verification
  app.use('/payments/webhook', express.raw({ type: 'application/json' }));

  // All other endpoints use JSON parsing
  app.use(express.json());

  // Health check
  app.get('/payments/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', service: 'payment-service' });
  });

  // Mount payment routes
  app.use('/payments', createPaymentRouter(controller));

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
