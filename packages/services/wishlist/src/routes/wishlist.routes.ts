import { Router } from 'express';
import { WishlistController } from '../controllers/wishlist.controller';

export function createWishlistRouter(controller: WishlistController): Router {
  const router = Router();

  router.post('/', controller.create);
  router.get('/share/:shareToken', controller.getByShareToken);
  router.get('/user/:userId', controller.getUserWishlists);
  router.get('/:id', controller.getById);
  router.post('/:id/items', controller.addItem);
  router.delete('/:id/items/:itemId', controller.removeItem);

  return router;
}
