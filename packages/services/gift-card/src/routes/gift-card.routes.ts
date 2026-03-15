import { Router } from 'express';
import { GiftCardController } from '../controllers/gift-card.controller';

export function createGiftCardRouter(controller: GiftCardController): Router {
  const router = Router();

  router.post('/validate', controller.validateCode);
  router.post('/redeem', controller.redeemCode);
  router.get('/:id', controller.getGiftCard);
  router.get('/:id/audit-log', controller.getAuditLog);

  return router;
}
