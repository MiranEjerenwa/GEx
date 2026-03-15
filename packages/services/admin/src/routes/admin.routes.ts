import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  router.get('/dashboard', controller.getDashboard);
  router.get('/orders', controller.searchOrders);
  router.get('/gift-cards/:id', controller.getGiftCardDetail);
  router.post('/gift-cards/:id/resend', controller.resendGiftCardEmail);
  router.put('/partners/:id/commission', controller.updateCommissionRate);
  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);

  return router;
}
