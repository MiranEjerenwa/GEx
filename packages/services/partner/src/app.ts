import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { PartnerController } from './controllers/partner.controller';
import { createPartnerRouter } from './routes/partner.routes';

export interface AppOptions {
  controller: PartnerController;
  logger: Logger;
}

export function createApp(options: AppOptions): express.Application {
  const { controller, logger } = options;
  const app = express();

  app.use(express.json());

  app.get('/partners/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', service: 'partner-service' });
  });

  app.use('/partners', createPartnerRouter(controller));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}
