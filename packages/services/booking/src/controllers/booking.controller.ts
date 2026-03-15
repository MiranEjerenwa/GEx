import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { BookingService } from '../services/booking.service';
import { BookingError } from '../repositories/booking.repository';
import { v4 as uuidv4 } from 'uuid';

export class BookingController {
  private bookingService: BookingService;
  private logger: Logger;

  constructor(bookingService: BookingService, logger: Logger) {
    this.bookingService = bookingService;
    this.logger = logger;
  }

  getBooking = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const booking = await this.bookingService.getBooking(id);
      res.status(200).json(booking);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getBookingByGiftCard = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { giftCardId } = req.params;
      const booking = await this.bookingService.getBookingByGiftCard(giftCardId);
      if (!booking) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'No booking found for this gift card', requestId, traceId: requestId },
        });
        return;
      }
      res.status(200).json(booking);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getPartnerBookings = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { partnerId } = req.params;
      const bookings = await this.bookingService.getPartnerBookings(partnerId);
      res.status(200).json(bookings);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({
        error: { code: error.code, message: error.message, requestId, traceId: requestId },
      });
      return;
    }

    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });

    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, traceId: requestId },
    });
  }
}
