import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';

export function createCatalogRouter(controller: CatalogController): Router {
  const router = Router();

  router.get('/experiences', controller.listExperiences);
  router.get('/experiences/:id', controller.getExperience);
  router.get('/categories', controller.getCategories);
  router.get('/occasions', controller.getOccasions);
  router.get('/occasions/:id/collection', controller.getOccasionCollection);
  router.get('/occasions/:id/templates', controller.getOccasionTemplates);

  return router;
}
