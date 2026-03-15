import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { NotificationService } from '../services/notification.service';
import { v4 as uuidv4 } from 'uuid';

export class NotificationController {
  private notificationService: NotificationService;
  private logger: Logger;

  constructor(notificationService: NotificationService, logger: Logger) {
    this.notificationService = notificationService;
    this.logger = logger;
  }

  resendGiftCard = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { giftCardId } = req.params;
      await this.notificationService.resendGiftCardEmail(giftCardId);
      res.status(200).json({ message: 'Resend initiated' });
    } catch (error) {
      this.logger.error('Resend failed', { error: error instanceof Error ? error.message : String(error), requestId });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to resend notification', requestId, traceId: requestId },
      });
    }
  };

  getDeliveryStatus = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { giftCardId } = req.params;
      const logs = await this.notificationService.getDeliveryStatus(giftCardId);
      res.status(200).json(logs);
    } catch (error) {
      this.logger.error('Status lookup failed', { error: error instanceof Error ? error.message : String(error), requestId });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get delivery status', requestId, traceId: requestId },
      });
    }
  };
}
