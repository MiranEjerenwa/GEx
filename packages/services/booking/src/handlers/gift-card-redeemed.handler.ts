import { Logger, GiftCardRedeemedEvent } from '@experience-gift/shared-types';
import { BookingService } from '../services/booking.service';

/**
 * Handle GiftCardRedeemed events from EventBridge.
 * Creates a booking with status 'confirmed' and reserves the time slot.
 */
export async function handleGiftCardRedeemed(
  event: GiftCardRedeemedEvent,
  bookingService: BookingService,
  logger: Logger,
): Promise<void> {
  logger.info('Handling GiftCardRedeemed event', { giftCardId: event.giftCardId });

  await bookingService.createBooking({
    giftCardId: event.giftCardId,
    experienceId: event.experienceId,
    timeSlotId: `${event.bookingDate}-${event.bookingTime}`,
    partnerId: '', // Will be resolved from experience lookup in production
    recipientEmail: event.recipientEmail,
    bookingDate: event.bookingDate,
    bookingTime: event.bookingTime,
  });

  logger.info('Booking created from gift card redemption', { giftCardId: event.giftCardId });
}
