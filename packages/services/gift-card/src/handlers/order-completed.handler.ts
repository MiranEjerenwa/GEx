import { Logger, OrderCompletedEvent } from '@experience-gift/shared-types';
import { GiftCardService } from '../services/gift-card.service';

/**
 * Handle OrderCompleted events from EventBridge.
 * Creates a gift card with status 'purchased'.
 */
export async function handleOrderCompleted(
  event: OrderCompletedEvent,
  giftCardService: GiftCardService,
  logger: Logger,
): Promise<void> {
  logger.info('Handling OrderCompleted event', { orderId: event.orderId });

  await giftCardService.createGiftCard({
    orderId: event.orderId,
    experienceId: event.experienceId,
    recipientEmail: event.recipientEmail,
    recipientName: event.recipientName,
    occasion: event.occasion,
    occasionTemplateId: event.ageGroup,
    experienceName: undefined,
  });

  logger.info('Gift card created for order', { orderId: event.orderId });
}
