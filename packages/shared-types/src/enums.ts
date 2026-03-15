export enum GiftCardStatus {
  PURCHASED = 'purchased',
  DELIVERED = 'delivered',
  REDEEMED = 'redeemed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum OnboardingStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum AgeGroup {
  TODDLER = 'toddler',
  KIDS = 'kids',
  TWEENS = 'tweens',
  TEENS = 'teens',
  FAMILY = 'family',
}

export enum FulfillmentStatus {
  UNFULFILLED = 'unfulfilled',
  FULFILLED = 'fulfilled',
}

export enum MomentStatus {
  PENDING_CONSENT = 'pending_consent',
  PENDING_GUARDIAN_APPROVAL = 'pending_guardian_approval',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

export enum ExperienceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum PartnerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum StripeConnectStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESTRICTED = 'restricted',
}

export enum PaymentSplitStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum NotificationType {
  DELIVERY = 'delivery',
  BOOKING_CONFIRMATION = 'booking_confirmation',
  PARTNER_NOTIFICATION = 'partner_notification',
  WELCOME = 'welcome',
  REJECTION = 'rejection',
  WISHLIST_FULFILLED = 'wishlist_fulfilled',
  SHARING_PROMPT = 'sharing_prompt',
}

export enum NotificationStatus {
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}
