import {
  Logger,
  GiftCardCreatedEvent,
  BookingConfirmedEvent,
  PartnerApprovedEvent,
  PartnerRejectedEvent,
  WishlistItemFulfilledEvent,
  BookingDatePassedEvent,
  NotificationType,
  NotificationStatus,
} from '@experience-gift/shared-types';
import { EmailService } from './email.service';
import * as notificationLogRepo from '../repositories/notification-log.repository';

export class NotificationService {
  private emailService: EmailService;
  private logger: Logger;

  constructor(emailService: EmailService, logger: Logger) {
    this.emailService = emailService;
    this.logger = logger;
  }

  async handleGiftCardCreated(event: GiftCardCreatedEvent): Promise<void> {
    const subject = `You've received an experience gift!`;
    const html = `
      <h1>You've received an experience gift!</h1>
      <p>Someone special has gifted you an amazing experience: <strong>${event.experienceName}</strong></p>
      <p>Your redemption code: <strong>${event.redemptionCode}</strong></p>
      <p>Visit our site to redeem your gift and book your experience.</p>
    `;

    await this.sendAndLog(
      event.recipientEmail,
      subject,
      html,
      NotificationType.DELIVERY,
      event.giftCardId,
    );
  }

  async handleBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
    // Notify recipient
    const recipientSubject = 'Your experience booking is confirmed!';
    const recipientHtml = `
      <h1>Booking Confirmed</h1>
      <p>Your experience has been booked for <strong>${event.date}</strong> at <strong>${event.time}</strong>.</p>
      <p>Booking ID: ${event.bookingId}</p>
    `;
    await this.sendAndLog(
      event.recipientEmail,
      recipientSubject,
      recipientHtml,
      NotificationType.BOOKING_CONFIRMATION,
      event.bookingId,
    );
  }

  async handlePartnerApproved(event: PartnerApprovedEvent): Promise<void> {
    const subject = 'Welcome to Experience Gift Platform!';
    const html = `
      <h1>Your partner application has been approved!</h1>
      <p>Welcome, ${event.businessName}! Your account is now active.</p>
      <p>You can log in to the Partner Portal to start listing your experiences.</p>
    `;
    await this.sendAndLog(
      event.contactEmail,
      subject,
      html,
      NotificationType.WELCOME,
      event.partnerId,
    );
  }

  async handlePartnerRejected(event: PartnerRejectedEvent): Promise<void> {
    const subject = 'Update on your partner application';
    const html = `
      <h1>Application Update</h1>
      <p>We've reviewed your application and unfortunately we're unable to approve it at this time.</p>
      <p>Reason: ${event.rejectionReason}</p>
      <p>You're welcome to reapply in the future.</p>
    `;
    await this.sendAndLog(
      event.contactEmail,
      subject,
      html,
      NotificationType.REJECTION,
      event.applicationId,
    );
  }

  async handleWishlistItemFulfilled(event: WishlistItemFulfilledEvent): Promise<void> {
    // Privacy-preserving: don't reveal what was purchased or by whom
    const subject = 'Someone got you something from your wishlist!';
    const html = `
      <h1>Wishlist Update</h1>
      <p>Great news — someone has fulfilled an item from your wishlist!</p>
      <p>Check your email soon for a gift card with all the details.</p>
    `;
    await this.sendAndLog(
      event.wishlistOwnerEmail,
      subject,
      html,
      NotificationType.WISHLIST_FULFILLED,
      event.wishlistItemId,
    );
  }

  async handleBookingDatePassed(event: BookingDatePassedEvent): Promise<void> {
    const subject = 'How was your experience? Share your moment!';
    const html = `
      <h1>Share Your Experience</h1>
      <p>We hope you had an amazing time! Would you like to share a moment from your experience with the community?</p>
      <p>Visit our community page to share a photo and caption.</p>
    `;
    await this.sendAndLog(
      event.recipientEmail,
      subject,
      html,
      NotificationType.SHARING_PROMPT,
      event.bookingId,
    );
  }

  async resendGiftCardEmail(giftCardId: string): Promise<void> {
    // Look up existing notification log to get details
    const logs = await notificationLogRepo.getByReferenceId(giftCardId);
    if (logs.length === 0) {
      throw new Error('No notification found for this gift card');
    }
    const original = logs[0];
    await this.emailService.sendWithRetry(
      original.recipient_email,
      'Resending: Your experience gift!',
      '<p>This is a resend of your gift card notification. Please check your original email for details.</p>',
    );
    this.logger.info('Gift card email resent', { giftCardId });
  }

  async getDeliveryStatus(giftCardId: string): Promise<notificationLogRepo.NotificationLogEntry[]> {
    return notificationLogRepo.getByReferenceId(giftCardId);
  }

  private async sendAndLog(
    to: string,
    subject: string,
    html: string,
    type: string,
    referenceId: string,
  ): Promise<void> {
    try {
      await this.emailService.sendWithRetry(to, subject, html);
      await notificationLogRepo.logNotification({
        recipient_email: to,
        notification_type: type,
        status: NotificationStatus.SENT,
        reference_id: referenceId,
        attempt_count: 1,
      });
    } catch (error) {
      await notificationLogRepo.logNotification({
        recipient_email: to,
        notification_type: type,
        status: NotificationStatus.FAILED,
        reference_id: referenceId,
        attempt_count: 3,
        last_error: error instanceof Error ? error.message : String(error),
      });
      this.logger.error('Notification failed', { to, type, referenceId });
    }
  }
}
