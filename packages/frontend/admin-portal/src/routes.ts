/**
 * Admin Portal route constants
 */
export const AdminRoutes = {
  LOGIN: '/login',
  DASHBOARD: '/',
  ORDERS: '/orders',
  GIFT_CARD_DETAIL: '/gift-cards/:id',
  PARTNERS: '/partners',
  PARTNER_COMMISSIONS: '/partners/commissions',
  ONBOARDING_QUEUE: '/onboarding',
  SETTINGS: '/settings',
  OCCASION_COLLECTIONS: '/occasions/collections',
} as const;

export function buildAdminRoute(route: string, params: Record<string, string>): string {
  let result = route;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}
