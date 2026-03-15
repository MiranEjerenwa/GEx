import { Router } from 'express';
import { CommunityController } from '../controllers/community.controller';

export function createCommunityRouter(controller: CommunityController): Router {
  const router = Router();

  router.get('/impact', controller.getImpact);
  router.get('/impact/user/:userId', controller.getUserImpact);
  router.get('/impact/user/:userId/badge', controller.getBadge);
  router.get('/feed', controller.getFeed);
  router.post('/moments', controller.submitMoment);
  router.post('/moments/:id/approve', controller.approveMoment);

  return router;
}
