import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();

  router.post('/resend/:giftCardId', controller.resendGiftCard);
  router.get('/status/:giftCardId', controller.getDeliveryStatus);

  return router;
}
