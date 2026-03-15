/** Domain events published via Amazon EventBridge */

export interface OrderCompletedEvent {
  orderId: string;
  experienceId: string;
  partnerId: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  personalizedMessage?: string;
  occasion: string;
  ageGroup?: string;
  amountCents: number;
  wishlistItemId?: string;
}

export interface GiftCardCreatedEvent {
  giftCardId: string;
  orderId: string;
  redemptionCode: string;
  recipientEmail: string;
  recipientName: string;
  experienceName: string;
  occasion: string;
  occasionTemplateId?: string;
}

export interface GiftCardDeliveredEvent {
  giftCardId: string;
  redemptionCode: string;
  deliveredAt: string;
}

export interface GiftCardRedeemedEvent {
  giftCardId: string;
  redemptionCode: string;
  experienceId: string;
  bookingDate: string;
  bookingTime: string;
  recipientEmail: string;
}

export interface BookingConfirmedEvent {
  bookingId: string;
  giftCardId: string;
  experienceId: string;
  partnerId: string;
  date: string;
  time: string;
  recipientEmail: string;
}

export interface BookingDatePassedEvent {
  bookingId: string;
  experienceId: string;
  recipientEmail: string;
  bookingDate: string;
}

export interface PartnerApprovedEvent {
  partnerId: string;
  businessName: string;
  contactEmail: string;
}

export interface PartnerRejectedEvent {
  applicationId: string;
  contactEmail: string;
  rejectionReason: string;
}

export interface ExperienceUpdatedEvent {
  experienceId: string;
  partnerId: string;
  action: 'created' | 'updated' | 'deactivated';
  ageGroups?: string[];
  occasions?: string[];
}

export interface WishlistItemFulfilledEvent {
  wishlistId: string;
  wishlistItemId: string;
  wishlistOwnerId: string;
  wishlistOwnerEmail: string;
}

export interface SharedMomentPublishedEvent {
  momentId: string;
  experienceId: string;
  experienceName: string;
  publishedAt: string;
}

export interface PaymentSplitEvent {
  orderId: string;
  partnerId: string;
  partnerAmountCents: number;
  platformAmountCents: number;
  commissionRate: number;
}

/** Union type of all domain events */
export type DomainEvent =
  | OrderCompletedEvent
  | GiftCardCreatedEvent
  | GiftCardDeliveredEvent
  | GiftCardRedeemedEvent
  | BookingConfirmedEvent
  | BookingDatePassedEvent
  | PartnerApprovedEvent
  | PartnerRejectedEvent
  | ExperienceUpdatedEvent
  | WishlistItemFulfilledEvent
  | SharedMomentPublishedEvent
  | PaymentSplitEvent;

/** Generic EventBridge envelope wrapping a typed domain event */
export interface EventBridgeEnvelope<T extends DomainEvent> {
  source: string;
  detailType: string;
  detail: T;
  time: string;
  eventBusName: string;
}

/** Typed EventBridge event aliases for each domain event */
export type OrderCompletedBridgeEvent = EventBridgeEnvelope<OrderCompletedEvent>;
export type GiftCardCreatedBridgeEvent = EventBridgeEnvelope<GiftCardCreatedEvent>;
export type GiftCardDeliveredBridgeEvent = EventBridgeEnvelope<GiftCardDeliveredEvent>;
export type GiftCardRedeemedBridgeEvent = EventBridgeEnvelope<GiftCardRedeemedEvent>;
export type BookingConfirmedBridgeEvent = EventBridgeEnvelope<BookingConfirmedEvent>;
export type BookingDatePassedBridgeEvent = EventBridgeEnvelope<BookingDatePassedEvent>;
export type PartnerApprovedBridgeEvent = EventBridgeEnvelope<PartnerApprovedEvent>;
export type PartnerRejectedBridgeEvent = EventBridgeEnvelope<PartnerRejectedEvent>;
export type ExperienceUpdatedBridgeEvent = EventBridgeEnvelope<ExperienceUpdatedEvent>;
export type WishlistItemFulfilledBridgeEvent = EventBridgeEnvelope<WishlistItemFulfilledEvent>;
export type SharedMomentPublishedBridgeEvent = EventBridgeEnvelope<SharedMomentPublishedEvent>;
export type PaymentSplitBridgeEvent = EventBridgeEnvelope<PaymentSplitEvent>;

/** EventBridge detail types for routing */
export const EventDetailType = {
  ORDER_COMPLETED: 'OrderCompleted',
  GIFT_CARD_CREATED: 'GiftCardCreated',
  GIFT_CARD_DELIVERED: 'GiftCardDelivered',
  GIFT_CARD_REDEEMED: 'GiftCardRedeemed',
  BOOKING_CONFIRMED: 'BookingConfirmed',
  BOOKING_DATE_PASSED: 'BookingDatePassed',
  PARTNER_APPROVED: 'PartnerApproved',
  PARTNER_REJECTED: 'PartnerRejected',
  EXPERIENCE_UPDATED: 'ExperienceUpdated',
  WISHLIST_ITEM_FULFILLED: 'WishlistItemFulfilled',
  SHARED_MOMENT_PUBLISHED: 'SharedMomentPublished',
  PAYMENT_SPLIT: 'PaymentSplit',
} as const;

export const EVENT_BUS_NAME = 'experience-gift-platform-bus';
export const EVENT_SOURCE = 'experience-gift-platform';
