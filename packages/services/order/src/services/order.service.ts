import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  OrderCompletedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import * as orderRepo from '../repositories/order.repository';
import type { Order, CreateOrderInput } from '../repositories/order.repository';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';

export interface PaymentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
}

export class OrderService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(eventBridge: EventBridgeClient, logger: Logger) {
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    this.validateCreateOrderInput(input);
    const order = await orderRepo.create(input);
    this.logger.info('Order created', { orderId: order.id, referenceNumber: order.reference_number });
    return order;
  }

  async processPayment(orderId: string, paymentDetails: { partnerId: string }): Promise<PaymentResult> {
    const order = await orderRepo.getById(orderId);
    if (!order) {
      throw new OrderError(ErrorCode.NOT_FOUND, 'Order not found', 404);
    }

    if (order.payment_status !== 'pending') {
      throw new OrderError(ErrorCode.VALIDATION_ERROR, `Order payment is already ${order.payment_status}`, 400);
    }

    // Delegate to Payment Service
    let paymentResult: PaymentResult;
    try {
      const response = await fetch(`${PAYMENT_SERVICE_URL}/payments/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amountCents: order.amount_cents,
          currency: order.currency,
          partnerId: paymentDetails.partnerId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = (errorBody as Record<string, Record<string, string>>)?.error?.message || 'Payment processing failed';
        throw new OrderError(ErrorCode.PAYMENT_GATEWAY_ERROR, errorMessage, response.status);
      }

      const body = await response.json() as { paymentIntentId: string; clientSecret: string };
      paymentResult = {
        paymentIntentId: body.paymentIntentId,
        clientSecret: body.clientSecret,
        status: 'authorized',
      };
    } catch (error) {
      if (error instanceof OrderError) throw error;
      this.logger.error('Payment service call failed', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OrderError(ErrorCode.PAYMENT_GATEWAY_ERROR, 'Unable to reach payment service. Please retry.', 502);
    }

    // Update order with payment info
    await orderRepo.updatePaymentStatus(orderId, 'authorized', paymentResult.paymentIntentId);

    // Publish OrderCompleted event
    await this.publishOrderCompleted(order, paymentDetails.partnerId);

    this.logger.info('Payment processed and OrderCompleted event published', { orderId });
    return paymentResult;
  }

  async getOrderStatus(referenceNumber: string, purchaserEmail: string): Promise<Order | null> {
    const order = await orderRepo.getByReferenceNumber(referenceNumber);
    if (!order) return null;

    // Security: verify purchaser email matches
    if (order.purchaser_email.toLowerCase() !== purchaserEmail.toLowerCase()) {
      return null;
    }

    return order;
  }

  async requestResend(orderId: string): Promise<void> {
    const order = await orderRepo.getById(orderId);
    if (!order) {
      throw new OrderError(ErrorCode.NOT_FOUND, 'Order not found', 404);
    }

    // Publish a resend event for the Notification Service to consume
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: 'GiftCardResendRequested',
          Detail: JSON.stringify({
            orderId: order.id,
            recipientEmail: order.recipient_email,
            recipientName: order.recipient_name,
          }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await this.eventBridge.send(command);
    this.logger.info('Resend event published', { orderId });
  }

  private validateCreateOrderInput(input: CreateOrderInput): void {
    const missing: string[] = [];
    if (!input.purchaser_email) missing.push('purchaser_email');
    if (!input.recipient_name) missing.push('recipient_name');
    if (!input.recipient_email) missing.push('recipient_email');
    if (!input.experience_id) missing.push('experience_id');
    if (!input.occasion) missing.push('occasion');
    if (!input.amount_cents || input.amount_cents <= 0) missing.push('amount_cents');

    if (missing.length > 0) {
      throw new OrderError(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${missing.join(', ')}`,
        400,
      );
    }
  }

  private async publishOrderCompleted(order: Order, partnerId: string): Promise<void> {
    const payload: OrderCompletedEvent = {
      orderId: order.id,
      experienceId: order.experience_id,
      partnerId,
      purchaserEmail: order.purchaser_email,
      recipientName: order.recipient_name,
      recipientEmail: order.recipient_email,
      personalizedMessage: order.personalized_message ?? undefined,
      occasion: order.occasion,
      ageGroup: order.age_group_context ?? undefined,
      amountCents: order.amount_cents,
      wishlistItemId: order.wishlist_item_id ?? undefined,
    };

    const command = new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: EventDetailType.ORDER_COMPLETED,
          Detail: JSON.stringify(payload),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await this.eventBridge.send(command);
  }
}

export class OrderError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
