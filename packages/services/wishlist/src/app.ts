import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { WishlistController } from './controllers/wishlist.controller';
import { createWishlistRouter } from './routes/wishlist.routes';

export interface AppOptions {
  controller: WishlistController;
  logger: Logger;
}

export function createApp(options: AppOptions): express.Application {
  const { controller, logger } = options;
  const app = express();
  app.use(express.json());

  app.get('/wishlists/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', service: 'wishlist-service' });
  });

  app.use('/wishlists', createWishlistRouter(controller));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });

  return app;
}
