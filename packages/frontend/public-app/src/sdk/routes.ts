/**
 * Public App route constants
 * Used by the frontend router and for generating links
 */
export const Routes = {
  // Catalog
  HOME: '/',
  BROWSE: '/experiences',
  EXPERIENCE_DETAIL: '/experiences/:id',
  CATEGORY: '/experiences/category/:slug',
  OCCASION: '/occasions/:slug',
  OCCASION_COLLECTION: '/occasions/:slug/collection',
  SEARCH: '/search',

  // Purchase flow
  PURCHASE: '/experiences/:id/purchase',
  ORDER_CONFIRMATION: '/orders/:id/confirmation',
  ORDER_STATUS: '/orders/status',

  // Redemption flow
  REDEEM: '/redeem',
  REDEEM_CODE: '/redeem/:code',
  BOOKING_CONFIRMATION: '/bookings/:id/confirmation',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',

  // Wishlists
  WISHLISTS: '/wishlists',
  WISHLIST_DETAIL: '/wishlists/:id',
  WISHLIST_SHARED: '/wishlists/share/:shareToken',

  // Community
  COMMUNITY_IMPACT: '/community',
  MY_IMPACT: '/community/my-impact',
  COMMUNITY_FEED: '/community/feed',
  SHARE_MOMENT: '/community/share/:bookingId',
} as const;

/** Helper to build a route with params */
export function buildRoute(route: string, params: Record<string, string>): string {
  let result = route;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}
