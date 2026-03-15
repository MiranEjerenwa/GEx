import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

export function createPaymentRouter(controller: PaymentController): Router {
  const router = Router();

  router.post('/intent', controller.createPaymentIntent);
  router.post('/webhook', controller.handleWebhook);
  router.get('/partner/:partnerId/payouts', controller.getPartnerPayouts);
  router.get('/commissions', controller.getCommissionRates);
  router.put('/commissions/:partnerId', controller.updateCommissionRate);
  router.post('/partner/:partnerId/stripe-connect', controller.createStripeConnectAccount);

  return router;
}
