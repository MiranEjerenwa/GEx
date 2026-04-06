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

    // Demo mode: simulate successful payment
    const paymentIntentId = `pi_demo_${Date.now()}`;
    await orderRepo.updatePaymentStatus(orderId, 'completed', paymentIntentId);

    // Publish OrderCompleted event
    try {
      await this.publishOrderCompleted(order, paymentDetails.partnerId);
    } catch (err) {
      this.logger.warn('Failed to publish OrderCompleted event', { orderId, error: String(err) });
    }

    this.logger.info('Payment processed', { orderId });
    return {
      paymentIntentId,
      clientSecret: `cs_demo_${Date.now()}`,
      status: 'completed',
    };
  }

  async listByPurchaserEmail(email: string): Promise<Order[]> {
    return orderRepo.searchByPurchaserEmail(email);
  }

  async listByRecipientEmail(email: string): Promise<Order[]> {
    return orderRepo.searchByRecipientEmail(email);
  }

  async getOrderStatus(referenceNumber: string, purchaserEmail: string): Promise<Order | null> {
    const order = await orderRepo.getByReferenceNumber(referenceNumber);
    if (!order) return null;
    if (order.purchaser_email.toLowerCase() !== purchaserEmail.toLowerCase()) return null;
    return order;
  }

  async requestResend(orderId: string): Promise<void> {
    const order = await orderRepo.getById(orderId);
    if (!order) {
      throw new OrderError(ErrorCode.NOT_FOUND, 'Order not found', 404);
    }

    try {
      const command = new PutEventsCommand({
        Entries: [{
          Source: EVENT_SOURCE,
          DetailType: 'GiftCardResendRequested',
          Detail: JSON.stringify({
            orderId: order.id,
            recipientEmail: order.recipient_email,
            recipientName: order.recipient_name,
          }),
          EventBusName: EVENT_BUS_NAME,
        }],
      });
      await this.eventBridge.send(command);
    } catch (err) {
      this.logger.warn('Failed to publish resend event', { orderId, error: String(err) });
    }
    this.logger.info('Resend request submitted', { orderId });
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

  private async createGiftCardForOrder(order: Order): Promise<void> {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const { v4: uuidv4 } = await import('uuid');

    const suffix = process.env.DYNAMO_TABLE_SUFFIX ? `-${process.env.DYNAMO_TABLE_SUFFIX}` : '';
    const table = `experience-gift-gift-cards${suffix}`;
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'GEX-';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];

    const now = new Date().toISOString();
    await ddb.send(new PutCommand({
      TableName: table,
      Item: {
        id: uuidv4(),
        orderId: order.id,
        experienceId: order.experience_id,
        recipientEmail: order.recipient_email,
        redemptionCode: code,
        status: 'delivered',
        deliveredAt: now,
        redeemedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    }));
    this.logger.info('Gift card created for order', { orderId: order.id, redemptionCode: code });
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
      Entries: [{
        Source: EVENT_SOURCE,
        DetailType: EventDetailType.ORDER_COMPLETED,
        Detail: JSON.stringify(payload),
        EventBusName: EVENT_BUS_NAME,
      }],
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