import { OrderCompletedEvent, Logger } from '@experience-gift/shared-types';
import { PaymentService } from '../services/payment.service';

/**
 * Handles the OrderCompleted EventBridge event.
 * Initiates payment split processing for the completed order.
 */
export class OrderCompletedHandler {
  private paymentService: PaymentService;
  private logger: Logger;

  constructor(paymentService: PaymentService, logger: Logger) {
    this.paymentService = paymentService;
    this.logger = logger;
  }

  async handle(event: OrderCompletedEvent): Promise<void> {
    this.logger.info('Received OrderCompleted event', {
      orderId: event.orderId,
      partnerId: event.partnerId,
      amountCents: event.amountCents,
    });

    try {
      await this.paymentService.handleOrderCompleted(event);
      this.logger.info('OrderCompleted event processed successfully', {
        orderId: event.orderId,
      });
    } catch (error) {
      this.logger.error('Failed to process OrderCompleted event', {
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
