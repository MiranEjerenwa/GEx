/**
 * Partner Portal route constants
 */
export const PartnerRoutes = {
  LOGIN: '/login',
  DASHBOARD: '/',
  EXPERIENCES: '/experiences',
  EXPERIENCE_CREATE: '/experiences/new',
  EXPERIENCE_EDIT: '/experiences/:id/edit',
  BOOKINGS: '/bookings',
  ONBOARDING: '/onboarding',
  STRIPE_CONNECT: '/stripe-connect',
} as const;

export function buildPartnerRoute(route: string, params: Record<string, string>): string {
  let result = route;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}
