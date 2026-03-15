/**
 * Partner Portal API Client
 * Typed HTTP client for partner-facing API endpoints
 */
import {
  AuthTokens,
  AgeGroup,
  ExperienceStatus,
  OnboardingStatus,
  BookingStatus,
  StripeConnectStatus,
  PaginatedResult,
} from '@experience-gift/shared-types';

// ── View Models ──

export interface PartnerDashboard {
  partnerId: string;
  businessName: string;
  experiences: PartnerExperience[];
  upcomingBookings: PartnerBooking[];
  totalBookings: number;
  stripeConnectStatus: StripeConnectStatus;
}

export interface PartnerExperience {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  ageGroups: AgeGroup[];
  occasions: string[];
  status: ExperienceStatus;
  availableDates: string[];
  availableTimes: string[];
  capacity: number;
  location: string;
  totalBookings: number;
}

export interface CreateExperienceRequest {
  name: string;
  description: string;
  fullDescription: string;
  category: string;
  price: number;
  imageUrl: string;
  ageGroups: AgeGroup[];
  occasions?: string[];
  availableDates: string[];
  availableTimes: string[];
  capacity: number;
  location: string;
}

export interface UpdateExperienceRequest extends Partial<CreateExperienceRequest> {
  id: string;
}

export interface PartnerBooking {
  id: string;
  experienceId: string;
  experienceName: string;
  giftCardId: string;
  date: string;
  time: string;
  status: BookingStatus;
  recipientEmail: string;
  createdAt: string;
}

export interface OnboardingApplication {
  id: string;
  businessName: string;
  contactEmail: string;
  description: string;
  categories: string[];
  status: OnboardingStatus;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ApplyOnboardingRequest {
  businessName: string;
  contactEmail: string;
  description: string;
  categories: string[];
}

export interface StripeConnectLink {
  url: string;
  expiresAt: string;
}

export interface PartnerLoginRequest {
  email: string;
  password: string;
}

// ── API Client ──

export class PartnerApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as Record<string, any>)) as Record<string, any>;
      throw new PartnerApiError(response.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? response.statusText);
    }

    return response.json() as Promise<T>;
  }

  // ── Auth ──

  async login(data: PartnerLoginRequest): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/partner/login', { method: 'POST', body: JSON.stringify(data) });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/token/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  }

  // ── Dashboard ──

  async getDashboard(): Promise<PartnerDashboard> {
    return this.request<PartnerDashboard>('/partners/dashboard');
  }

  // ── Experiences ──

  async createExperience(data: CreateExperienceRequest): Promise<PartnerExperience> {
    return this.request<PartnerExperience>('/partners/experiences', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateExperience(id: string, data: Partial<CreateExperienceRequest>): Promise<PartnerExperience> {
    return this.request<PartnerExperience>(`/partners/experiences/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async setExperienceStatus(id: string, status: ExperienceStatus): Promise<PartnerExperience> {
    return this.request<PartnerExperience>(`/partners/experiences/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  // ── Bookings ──

  async getBookings(page?: number, limit?: number): Promise<PaginatedResult<PartnerBooking>> {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<PaginatedResult<PartnerBooking>>(`/partners/bookings${qs ? `?${qs}` : ''}`);
  }

  // ── Onboarding ──

  async applyOnboarding(data: ApplyOnboardingRequest): Promise<OnboardingApplication> {
    return this.request<OnboardingApplication>('/partners/onboarding/apply', { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Stripe Connect ──

  async getStripeConnectLink(partnerId: string): Promise<StripeConnectLink> {
    return this.request<StripeConnectLink>(`/partners/${partnerId}/stripe-connect/onboarding-link`);
  }
}

// ── Error Class ──

export class PartnerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PartnerApiError';
  }
}
