import { Router } from 'express';
import { PartnerController } from '../controllers/partner.controller';

export function createPartnerRouter(controller: PartnerController): Router {
  const router = Router();

  router.get('/dashboard', controller.getDashboard);
  router.get('/', controller.getAllPartners);
  router.post('/onboarding/apply', controller.submitApplication);
  router.get('/onboarding', controller.getPendingApplications);
  router.post('/onboarding/:id/approve', controller.approveApplication);
  router.post('/onboarding/:id/reject', controller.rejectApplication);
  router.get('/:id/stripe-connect/onboarding-link', controller.getStripeOnboardingLink);
  router.post('/experiences/update', controller.publishExperienceUpdate);

  return router;
}
