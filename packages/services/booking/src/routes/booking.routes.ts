import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';

export function createBookingRouter(controller: BookingController): Router {
  const router = Router();

  router.get('/partner/:partnerId', controller.getPartnerBookings);
  router.get('/gift-card/:giftCardId', controller.getBookingByGiftCard);
  router.get('/:id', controller.getBooking);

  return router;
}
