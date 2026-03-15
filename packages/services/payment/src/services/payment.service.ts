import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  PaymentSplitEvent,
  OrderCompletedEvent,
  PartnerApprovedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import { StripeService } from './stripe.service';
import * as commissionRateRepo from '../repositories/commission-rate.repository';
import * as paymentSplitRepo from '../repositories/payment-split.repository';
import * as partnerStripeAccountRepo from '../repositories/partner-stripe-account.repository';
import type { CommissionRate } from '../repositories/commission-rate.repository';
import type { PaymentSplit } from '../repositories/payment-split.repository';
import type { PartnerStripeAccount } from '../repositories/partner-stripe-account.repository';

export interface CreatePaymentIntentInput {
  orderId: string;
  amountCents: number;
  currency: string;
  partnerId: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  split: {
    totalAmountCents: number;
    platformAmountCents: number;
    partnerAmountCents: number;
    commissionRatePercent: number;
  };
}

export interface PayoutListResult {
  items: PaymentSplit[];
  total: number;
}

export class PaymentService {
  private stripeService: StripeService;
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(stripeService: StripeService, eventBridge: EventBridgeClient, logger: Logger) {
    this.stripeService = stripeService;
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  /**
   * Calculate the split: platform commission is taken from the total.
   * total = platformAmount + partnerAmount
   * No service fees charged to purchasers — total charge = experience price.
   */
  private calculateSplit(amountCents: number, commissionRatePercent: number) {
    const platformAmountCents = Math.round(amountCents * (commissionRatePercent / 100));
    const partnerAmountCents = amountCents - platformAmountCents;
    return { platformAmountCents, partnerAmountCents };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const { orderId, amountCents, currency, partnerId } = input;

    // Check for existing split (idempotency)
    const existingSplit = await paymentSplitRepo.getByOrderId(orderId);
    if (existingSplit) {
      this.logger.info('Payment intent already exists for order', { orderId });
      return {
        paymentIntentId: existingSplit.stripe_payment_intent_id,
        clientSecret: '',
        split: {
          totalAmountCents: existingSplit.total_amount_cents,
          platformAmountCents: existingSplit.platform_amount_cents,
          partnerAmountCents: existingSplit.partner_amount_cents,
          commissionRatePercent: existingSplit.commission_rate_percent,
        },
      };
    }

    // Get partner Stripe account
    const partnerAccount = await partnerStripeAccountRepo.getByPartnerId(partnerId);
    if (!partnerAccount || !partnerAccount.payouts_enabled) {
      throw new PaymentError(
        ErrorCode.PARTNER_PAYOUTS_DISABLED,
        'Partner Stripe Connect account is not active or payouts are disabled',
        402,
      );
    }

    // Get effective commission rate
    const commissionRate = await commissionRateRepo.getEffectiveRate(partnerId);
    if (!commissionRate) {
      this.logger.warn('No commission rate found, using default', { partnerId });
      throw new PaymentError(
        ErrorCode.COMMISSION_RATE_MISSING,
        'Commission rate not configured and no default rate found',
        500,
      );
    }

    const { platformAmountCents, partnerAmountCents } = this.calculateSplit(
      amountCents,
      commissionRate.rate_percent,
    );

    // Idempotency key derived from order ID
    const idempotencyKey = `order-${orderId}`;

    const stripeResult = await this.stripeService.createPaymentIntent(
      amountCents,
      currency,
      partnerAccount.stripe_account_id,
      platformAmountCents,
      idempotencyKey,
    );

    // Record the split
    await paymentSplitRepo.create({
      orderId,
      partnerId,
      stripePaymentIntentId: stripeResult.paymentIntentId,
      totalAmountCents: amountCents,
      platformAmountCents,
      partnerAmountCents,
      commissionRatePercent: commissionRate.rate_percent,
      currency,
    });

    return {
      paymentIntentId: stripeResult.paymentIntentId,
      clientSecret: stripeResult.clientSecret,
      split: {
        totalAmountCents: amountCents,
        platformAmountCents,
        partnerAmountCents,
        commissionRatePercent: commissionRate.rate_percent,
      },
    };
  }

  async handleWebhook(event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
    this.logger.info('Processing webhook event', { type: event.type });

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntentId = event.data.object.id as string;
        await this.handlePaymentSucceeded(paymentIntentId);
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntentId = event.data.object.id as string;
        await this.handlePaymentFailed(paymentIntentId);
        break;
      }
      case 'account.updated': {
        const accountId = event.data.object.id as string;
        const payoutsEnabled = event.data.object.payouts_enabled as boolean;
        await this.handleAccountUpdated(accountId, payoutsEnabled);
        break;
      }
      default:
        this.logger.info('Unhandled webhook event type', { type: event.type });
    }
  }

  private async handlePaymentSucceeded(paymentIntentId: string): Promise<void> {
    // Find the split by looking up via stripe_payment_intent_id
    const splits = await paymentSplitRepo.listByPartnerId('', 1000, 0);
    const split = splits.items.find((s) => s.stripe_payment_intent_id === paymentIntentId);
    if (!split) {
      this.logger.warn('No payment split found for payment intent', { paymentIntentId });
      return;
    }

    await paymentSplitRepo.updateStatus(split.id, 'completed');

    // Publish PaymentSplit event
    await this.publishPaymentSplitEvent({
      orderId: split.order_id,
      partnerId: split.partner_id,
      partnerAmountCents: split.partner_amount_cents,
      platformAmountCents: split.platform_amount_cents,
      commissionRate: split.commission_rate_percent,
    });

    this.logger.info('Payment completed and event published', {
      orderId: split.order_id,
      paymentIntentId,
    });
  }

  private async handlePaymentFailed(paymentIntentId: string): Promise<void> {
    const splits = await paymentSplitRepo.listByPartnerId('', 1000, 0);
    const split = splits.items.find((s) => s.stripe_payment_intent_id === paymentIntentId);
    if (!split) {
      this.logger.warn('No payment split found for failed payment intent', { paymentIntentId });
      return;
    }

    await paymentSplitRepo.updateStatus(split.id, 'failed');
    this.logger.warn('Payment failed', { orderId: split.order_id, paymentIntentId });
  }

  private async handleAccountUpdated(accountId: string, payoutsEnabled: boolean): Promise<void> {
    const account = await partnerStripeAccountRepo.getByStripeAccountId(accountId);
    if (!account) {
      this.logger.warn('No partner account found for Stripe account', { accountId });
      return;
    }

    const status = payoutsEnabled ? 'active' : 'restricted';
    await partnerStripeAccountRepo.updateStatus(account.partner_id, status, payoutsEnabled);
    this.logger.info('Partner Stripe account updated', {
      partnerId: account.partner_id,
      status,
      payoutsEnabled,
    });
  }

  async getPartnerPayouts(partnerId: string, limit = 50, offset = 0): Promise<PayoutListResult> {
    return paymentSplitRepo.listByPartnerId(partnerId, limit, offset);
  }

  async getCommissionRates(): Promise<CommissionRate[]> {
    return commissionRateRepo.listAll();
  }

  async updateCommissionRate(partnerId: string, ratePercent: number): Promise<CommissionRate> {
    if (ratePercent < 0 || ratePercent > 100) {
      throw new PaymentError(
        ErrorCode.VALIDATION_ERROR,
        'Commission rate must be between 0 and 100',
        400,
      );
    }
    return commissionRateRepo.updateRate(partnerId, ratePercent);
  }

  async createStripeConnectAccount(partnerId: string, email: string, businessName: string): Promise<PartnerStripeAccount> {
    // Check if account already exists
    const existing = await partnerStripeAccountRepo.getByPartnerId(partnerId);
    if (existing) {
      this.logger.info('Stripe Connect account already exists for partner', { partnerId });
      return existing;
    }

    const result = await this.stripeService.createConnectAccount(email, businessName);
    return partnerStripeAccountRepo.create(partnerId, result.accountId);
  }

  /**
   * Handle OrderCompleted event — create payment intent with split.
   */
  async handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
    this.logger.info('Processing OrderCompleted event', { orderId: event.orderId });

    try {
      await this.createPaymentIntent({
        orderId: event.orderId,
        amountCents: event.amountCents,
        currency: 'USD',
        partnerId: event.partnerId,
      });
    } catch (error) {
      this.logger.error('Failed to process OrderCompleted event', {
        orderId: event.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle PartnerApproved event — create Stripe Connect account.
   */
  async handlePartnerApproved(event: PartnerApprovedEvent): Promise<void> {
    this.logger.info('Processing PartnerApproved event', { partnerId: event.partnerId });

    try {
      await this.createStripeConnectAccount(event.partnerId, event.contactEmail, event.businessName);
    } catch (error) {
      this.logger.error('Failed to create Stripe Connect account for partner', {
        partnerId: event.partnerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async publishPaymentSplitEvent(payload: PaymentSplitEvent): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: EventDetailType.PAYMENT_SPLIT,
          Detail: JSON.stringify(payload),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await this.eventBridge.send(command);
    this.logger.info('Published PaymentSplit event', { orderId: payload.orderId });
  }
}

export class PaymentError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
