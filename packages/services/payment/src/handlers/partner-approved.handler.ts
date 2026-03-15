import { PartnerApprovedEvent, Logger } from '@experience-gift/shared-types';
import { PaymentService } from '../services/payment.service';

/**
 * Handles the PartnerApproved EventBridge event.
 * Creates a Stripe Connect account for the newly approved partner.
 */
export class PartnerApprovedHandler {
  private paymentService: PaymentService;
  private logger: Logger;

  constructor(paymentService: PaymentService, logger: Logger) {
    this.paymentService = paymentService;
    this.logger = logger;
  }

  async handle(event: PartnerApprovedEvent): Promise<void> {
    this.logger.info('Received PartnerApproved event', {
      partnerId: event.partnerId,
      businessName: event.businessName,
    });

    try {
      await this.paymentService.handlePartnerApproved(event);
      this.logger.info('PartnerApproved event processed successfully', {
        partnerId: event.partnerId,
      });
    } catch (error) {
      this.logger.error('Failed to process PartnerApproved event', {
        partnerId: event.partnerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
