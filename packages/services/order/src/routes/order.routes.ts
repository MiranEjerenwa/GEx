import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

export function createOrderRouter(controller: OrderController): Router {
  const router = Router();

  router.get('/my-orders', controller.listByPurchaser);
  router.post('/', controller.createOrder);
  router.post('/:id/pay', controller.submitPayment);
  router.get('/status', controller.getOrderStatus);
  router.post('/:id/resend', controller.resendDeliveryEmail);

  return router;
}
