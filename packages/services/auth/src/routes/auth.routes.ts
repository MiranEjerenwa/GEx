import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  // Purchaser/Recipient registration
  router.post('/register', controller.register);

  // Purchaser/Recipient login
  router.post('/login', controller.login);

  // Partner login
  router.post('/partner/login', controller.partnerLogin);

  // Admin login (MFA required)
  router.post('/admin/login', controller.adminLogin);

  // Token refresh (all pools)
  router.post('/token/refresh', controller.refreshToken);

  // Create partner credentials (internal, triggered by PartnerApproved event)
  router.post('/partner/create', controller.createPartnerCredentials);

  return router;
}
