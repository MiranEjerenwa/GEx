import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { GiftCardService, GiftCardError } from '../services/gift-card.service';
import { v4 as uuidv4 } from 'uuid';

export class GiftCardController {
  private giftCardService: GiftCardService;
  private logger: Logger;

  constructor(giftCardService: GiftCardService, logger: Logger) {
    this.giftCardService = giftCardService;
    this.logger = logger;
  }

  validateCode = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { redemptionCode } = req.body;
      if (!redemptionCode) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'redemptionCode is required', requestId, traceId: requestId },
        });
        return;
      }

      const giftCard = await this.giftCardService.validateRedemptionCode(redemptionCode);
      res.status(200).json(giftCard);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  redeemCode = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { redemptionCode, bookingDate, bookingTime } = req.body;
      if (!redemptionCode || !bookingDate || !bookingTime) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'redemptionCode, bookingDate, and bookingTime are required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const requestingIp = req.ip || req.socket.remoteAddress || 'unknown';
      const result = await this.giftCardService.redeemGiftCard(
        redemptionCode,
        requestingIp,
        bookingDate,
        bookingTime,
      );

      if (result.alreadyRedeemed) {
        res.status(200).json({
          message: 'Gift card was already redeemed',
          giftCard: result.giftCard,
        });
        return;
      }

      res.status(200).json({ giftCard: result.giftCard });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getGiftCard = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const giftCard = await this.giftCardService.getGiftCard(id);
      res.status(200).json(giftCard);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getAuditLog = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const auditLog = await this.giftCardService.getAuditLog(id);
      res.status(200).json(auditLog);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof GiftCardError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          requestId,
          traceId: requestId,
        },
      });
      return;
    }

    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        traceId: requestId,
      },
    });
  }
}
