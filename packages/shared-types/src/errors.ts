/** Shared error response format used by all services */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    traceId: string;
    details?: Record<string, unknown>;
  };
}

/** Standard error codes used across services */
export const ErrorCode = {
  // Payment errors
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',

  // Redemption errors
  INVALID_REDEMPTION_CODE: 'INVALID_REDEMPTION_CODE',
  GIFT_CARD_NOT_DELIVERED: 'GIFT_CARD_NOT_DELIVERED',
  CONCURRENT_REDEMPTION: 'CONCURRENT_REDEMPTION',
  TIME_SLOT_UNAVAILABLE: 'TIME_SLOT_UNAVAILABLE',

  // Wishlist errors
  WISHLIST_NOT_FOUND: 'WISHLIST_NOT_FOUND',
  INVALID_SHARE_TOKEN: 'INVALID_SHARE_TOKEN',
  ITEM_ALREADY_IN_WISHLIST: 'ITEM_ALREADY_IN_WISHLIST',
  ITEM_ALREADY_FULFILLED: 'ITEM_ALREADY_FULFILLED',

  // Payment split errors
  PARTNER_PAYOUTS_DISABLED: 'PARTNER_PAYOUTS_DISABLED',
  COMMISSION_RATE_MISSING: 'COMMISSION_RATE_MISSING',
  TRANSFER_FAILED: 'TRANSFER_FAILED',

  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
