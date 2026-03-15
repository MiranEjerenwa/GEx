import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  GiftCardCreatedEvent,
  GiftCardDeliveredEvent,
  GiftCardRedeemedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
  GiftCardStatus,
} from '@experience-gift/shared-types';
import * as giftCardRepo from '../repositories/gift-card.repository';
import { RedemptionError } from '../repositories/gift-card.repository';
import * as auditLogRepo from '../repositories/audit-log.repository';
import type { RedemptionOutcome } from '../repositories/audit-log.repository';

export class GiftCardService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(eventBridge: EventBridgeClient, logger: Logger) {
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  /**
   * Create a gift card from an OrderCompleted event.
   */
  async createGiftCard(input: {
    orderId: string;
    experienceId: string;
    recipientEmail: string;
    recipientName: string;
    occasion: string;
    occasionTemplateId?: string;
    experienceName?: string;
  }): Promise<giftCardRepo.GiftCard> {
    // Idempotency: check if gift card already exists for this order
    const existing = await giftCardRepo.getByOrderId(input.orderId);
    if (existing) {
      this.logger.info('Gift card already exists for order', { orderId: input.orderId });
      return existing;
    }

    const giftCard = await giftCardRepo.create({
      order_id: input.orderId,
      experience_id: input.experienceId,
      recipient_email: input.recipientEmail,
    });

    this.logger.info('Gift card created', {
      giftCardId: giftCard.id,
      orderId: input.orderId,
    });

    // Publish GiftCardCreated event
    const payload: GiftCardCreatedEvent = {
      giftCardId: giftCard.id,
      orderId: input.orderId,
      redemptionCode: giftCard.redemption_code,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      experienceName: input.experienceName ?? '',
      occasion: input.occasion,
      occasionTemplateId: input.occasionTemplateId,
    };

    await this.publishEvent(EventDetailType.GIFT_CARD_CREATED, payload);
    return giftCard;
  }

  /**
   * Mark a gift card as delivered and publish GiftCardDelivered event.
   */
  async markAsDelivered(giftCardId: string): Promise<giftCardRepo.GiftCard> {
    const giftCard = await giftCardRepo.markAsDelivered(giftCardId);
    if (!giftCard) {
      throw new GiftCardError(ErrorCode.NOT_FOUND, 'Gift card not found', 404);
    }

    const payload: GiftCardDeliveredEvent = {
      giftCardId: giftCard.id,
      redemptionCode: giftCard.redemption_code,
      deliveredAt: giftCard.delivered_at?.toISOString() ?? new Date().toISOString(),
    };

    await this.publishEvent(EventDetailType.GIFT_CARD_DELIVERED, payload);
    this.logger.info('Gift card marked as delivered', { giftCardId });
    return giftCard;
  }

  /**
   * Validate a redemption code — returns experience details and available booking info.
   */
  async validateRedemptionCode(code: string): Promise<giftCardRepo.GiftCard> {
    const giftCard = await giftCardRepo.getByRedemptionCode(code);
    if (!giftCard) {
      throw new GiftCardError(ErrorCode.INVALID_REDEMPTION_CODE, 'Invalid redemption code', 400);
    }

    if (giftCard.status === GiftCardStatus.PURCHASED) {
      throw new GiftCardError(ErrorCode.GIFT_CARD_NOT_DELIVERED, 'Gift card has not been delivered yet', 400);
    }

    return giftCard;
  }

  /**
   * Redeem a gift card with atomic transaction (lock → verify → update → audit → publish).
   * Idempotent: if already redeemed, returns existing gift card.
   */
  async redeemGiftCard(
    redemptionCode: string,
    requestingIp: string,
    bookingDate: string,
    bookingTime: string,
  ): Promise<{ giftCard: giftCardRepo.GiftCard; alreadyRedeemed: boolean }> {
    let outcome: RedemptionOutcome = 'success';
    let giftCardId: string | undefined;

    try {
      const redeemed = await giftCardRepo.redeemWithLock(redemptionCode);
      giftCardId = redeemed.id;

      // Log successful redemption
      await auditLogRepo.logRedemptionAttempt(
        redemptionCode,
        requestingIp,
        'success',
        redeemed.id,
      );

      // Publish GiftCardRedeemed event
      const payload: GiftCardRedeemedEvent = {
        giftCardId: redeemed.id,
        redemptionCode,
        experienceId: redeemed.experience_id,
        bookingDate,
        bookingTime,
        recipientEmail: redeemed.recipient_email,
      };

      await this.publishEvent(EventDetailType.GIFT_CARD_REDEEMED, payload);
      this.logger.info('Gift card redeemed', { giftCardId: redeemed.id });

      return { giftCard: redeemed, alreadyRedeemed: false };
    } catch (error) {
      if (error instanceof RedemptionError) {
        outcome = error.outcome as RedemptionOutcome;
        giftCardId = error.existingGiftCard?.id;

        await auditLogRepo.logRedemptionAttempt(
          redemptionCode,
          requestingIp,
          outcome,
          giftCardId,
        );

        // Idempotent: already redeemed returns existing
        if (error.outcome === 'already_redeemed' && error.existingGiftCard) {
          this.logger.info('Idempotent redemption — already redeemed', { redemptionCode });
          return { giftCard: error.existingGiftCard, alreadyRedeemed: true };
        }

        if (error.outcome === 'invalid_code') {
          throw new GiftCardError(ErrorCode.INVALID_REDEMPTION_CODE, error.message, 400);
        }
        if (error.outcome === 'not_delivered') {
          throw new GiftCardError(ErrorCode.GIFT_CARD_NOT_DELIVERED, error.message, 400);
        }
        if (error.outcome === 'concurrent_conflict') {
          throw new GiftCardError(ErrorCode.CONCURRENT_REDEMPTION, error.message, 409);
        }
      }
      throw error;
    }
  }

  async getGiftCard(id: string): Promise<giftCardRepo.GiftCard> {
    const giftCard = await giftCardRepo.getById(id);
    if (!giftCard) {
      throw new GiftCardError(ErrorCode.NOT_FOUND, 'Gift card not found', 404);
    }
    return giftCard;
  }

  async getAuditLog(giftCardId: string): Promise<auditLogRepo.AuditLogEntry[]> {
    return auditLogRepo.getByGiftCardId(giftCardId);
  }

  private async publishEvent(detailType: string, payload: object): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: detailType,
          Detail: JSON.stringify(payload),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });
    await this.eventBridge.send(command);
  }
}

export class GiftCardError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'GiftCardError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
