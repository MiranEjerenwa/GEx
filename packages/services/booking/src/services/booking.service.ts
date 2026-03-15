import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  BookingConfirmedEvent,
  BookingDatePassedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import * as bookingRepo from '../repositories/booking.repository';
import { BookingError } from '../repositories/booking.repository';

const DEFAULT_CAPACITY = 20;

export class BookingService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(eventBridge: EventBridgeClient, logger: Logger) {
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  /**
   * Create a booking from a GiftCardRedeemed event.
   */
  async createBooking(input: {
    giftCardId: string;
    experienceId: string;
    timeSlotId: string;
    partnerId: string;
    recipientEmail: string;
    bookingDate: string;
    bookingTime: string;
    capacity?: number;
  }): Promise<bookingRepo.Booking> {
    const booking = await bookingRepo.createWithReservation(
      {
        gift_card_id: input.giftCardId,
        experience_id: input.experienceId,
        time_slot_id: input.timeSlotId,
        partner_id: input.partnerId,
        recipient_email: input.recipientEmail,
      },
      input.capacity ?? DEFAULT_CAPACITY,
    );

    // Publish BookingConfirmed event
    const payload: BookingConfirmedEvent = {
      bookingId: booking.id,
      giftCardId: input.giftCardId,
      experienceId: input.experienceId,
      partnerId: input.partnerId,
      date: input.bookingDate,
      time: input.bookingTime,
      recipientEmail: input.recipientEmail,
    };

    await this.publishEvent(EventDetailType.BOOKING_CONFIRMED, payload);
    this.logger.info('Booking created and confirmed', { bookingId: booking.id });
    return booking;
  }

  async getBooking(id: string): Promise<bookingRepo.Booking> {
    const booking = await bookingRepo.getById(id);
    if (!booking) {
      throw new BookingError(ErrorCode.NOT_FOUND, 'Booking not found', 404);
    }
    return booking;
  }

  async getBookingByGiftCard(giftCardId: string): Promise<bookingRepo.Booking | null> {
    return bookingRepo.getByGiftCardId(giftCardId);
  }

  async getPartnerBookings(partnerId: string): Promise<bookingRepo.Booking[]> {
    return bookingRepo.getByPartnerId(partnerId);
  }

  /**
   * Publish BookingDatePassed events for bookings whose dates have passed.
   * Intended to be called by a scheduled job.
   */
  async publishPastBookingEvents(): Promise<number> {
    const pastBookings = await bookingRepo.getPastBookings(new Date());
    let published = 0;

    for (const booking of pastBookings) {
      const payload: BookingDatePassedEvent = {
        bookingId: booking.id,
        experienceId: booking.experience_id,
        recipientEmail: booking.recipient_email,
        bookingDate: booking.created_at.toISOString(),
      };

      await this.publishEvent(EventDetailType.BOOKING_DATE_PASSED, payload);
      published++;
    }

    this.logger.info('Published BookingDatePassed events', { count: published });
    return published;
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
