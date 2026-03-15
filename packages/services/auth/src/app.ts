import express from 'express';
import { Logger } from '@experience-gift/shared-types';
import { CognitoService, PoolConfigs } from './services/cognito.service';
import { AuthController } from './controllers/auth.controller';
import { createAuthRoutes } from './routes/auth.routes';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { PartnerApprovedHandler } from './handlers/partner-approved.handler';

export interface AppConfig {
  pools: PoolConfigs;
  region: string;
}

export interface AppContext {
  app: express.Application;
  cognitoService: CognitoService;
  partnerApprovedHandler: PartnerApprovedHandler;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}

export function createApp(config: AppConfig): AppContext {
  const logger = new Logger({ serviceName: 'auth-service' });
  const cognitoService = new CognitoService(config.pools, config.region, logger);
  const controller = new AuthController(cognitoService, logger);
  const partnerApprovedHandler = new PartnerApprovedHandler(cognitoService, logger);
  const authMiddleware = createAuthMiddleware({ region: config.region, logger });

  const app = express();
  app.use(express.json());

  // Health check
  app.get('/auth/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', service: 'auth-service' });
  });

  // Auth routes
  app.use('/auth', createAuthRoutes(controller));

  return { app, cognitoService, partnerApprovedHandler, authMiddleware };
}
