/**
 * Admin Portal API Client
 * Typed HTTP client for admin-facing API endpoints
 */
import {
  AuthTokens,
  GiftCardStatus,
  BookingStatus,
  OnboardingStatus,
  PaginatedResult,
  PartnerStatus,
  StripeConnectStatus,
} from '@experience-gift/shared-types';

// ── View Models ──

export interface AdminDashboard {
  totalOrders: number;
  totalRevenueCents: number;
  activePartners: number;
  giftCardsByStatus: Record<GiftCardStatus, number>;
  bookingsForPeriod: number;
  periodStart: string;
  periodEnd: string;
}

export interface AdminOrder {
  id: string;
  referenceNumber: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  experienceName: string;
  amountCents: number;
  status: string;
  giftCardStatus?: GiftCardStatus;
  createdAt: string;
}

export interface AdminGiftCardDetail {
  id: string;
  orderId: string;
  redemptionCode: string;
  status: GiftCardStatus;
  experienceId: string;
  experienceName: string;
  recipientEmail: string;
  recipientName: string;
  createdAt: string;
  deliveredAt?: string;
  redeemedAt?: string;
  bookingId?: string;
  bookingDate?: string;
  bookingTime?: string;
  auditLog: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  outcome: string;
  ipAddress?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AdminPartner {
  id: string;
  businessName: string;
  contactEmail: string;
  status: PartnerStatus;
  stripeConnectStatus: StripeConnectStatus;
  activeExperienceCount: number;
  totalBookings: number;
  commissionRate: number;
  joinedAt: string;
}

export interface AdminOnboardingApplication {
  id: string;
  businessName: string;
  contactEmail: string;
  description: string;
  categories: string[];
  status: OnboardingStatus;
  submittedAt: string;
}

export interface PlatformSettings {
  emailTemplates: Record<string, string>;
  categories: string[];
  featureFlags: Record<string, boolean>;
}

export interface AdminActionLog {
  id: string;
  adminId: string;
  adminEmail: string;
  actionType: string;
  affectedRecord: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface CommissionUpdate {
  partnerId: string;
  rate: number;
}

export interface OccasionCollectionConfig {
  occasionId: string;
  title: string;
  experienceIds: string[];
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
  mfaCode: string;
}

// ── API Client ──

export class AdminApiClient {
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
      throw new AdminApiError(response.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? response.statusText);
    }

    return response.json() as Promise<T>;
  }

  // ── Auth ──

  async login(data: AdminLoginRequest): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/admin/login', { method: 'POST', body: JSON.stringify(data) });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/token/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  }

  // ── Dashboard ──

  async getDashboard(periodStart?: string, periodEnd?: string): Promise<AdminDashboard> {
    const params = new URLSearchParams();
    if (periodStart) params.set('periodStart', periodStart);
    if (periodEnd) params.set('periodEnd', periodEnd);
    const qs = params.toString();
    return this.request<AdminDashboard>(`/admin/dashboard${qs ? `?${qs}` : ''}`);
  }

  // ── Orders ──

  async searchOrders(query: { referenceNumber?: string; purchaserEmail?: string; recipientEmail?: string }): Promise<AdminOrder[]> {
    const params = new URLSearchParams();
    if (query.referenceNumber) params.set('referenceNumber', query.referenceNumber);
    if (query.purchaserEmail) params.set('purchaserEmail', query.purchaserEmail);
    if (query.recipientEmail) params.set('recipientEmail', query.recipientEmail);
    return this.request<AdminOrder[]>(`/admin/orders?${params}`);
  }

  // ── Gift Cards ──

  async getGiftCardDetail(id: string): Promise<AdminGiftCardDetail> {
    return this.request<AdminGiftCardDetail>(`/admin/gift-cards/${id}`);
  }

  async resendGiftCard(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/gift-cards/${id}/resend`, { method: 'POST' });
  }

  // ── Partners ──

  async listPartners(): Promise<AdminPartner[]> {
    return this.request<AdminPartner[]>('/admin/partners');
  }

  async listCommissions(): Promise<AdminPartner[]> {
    return this.request<AdminPartner[]>('/admin/partners/commissions');
  }

  async updateCommission(partnerId: string, rate: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/partners/${partnerId}/commission`, { method: 'PUT', body: JSON.stringify({ rate }) });
  }

  // ── Onboarding ──

  async listOnboardingApplications(): Promise<AdminOnboardingApplication[]> {
    return this.request<AdminOnboardingApplication[]>('/partners/onboarding');
  }

  async approveApplication(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/partners/onboarding/${id}/approve`, { method: 'POST' });
  }

  async rejectApplication(id: string, reason: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/partners/onboarding/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  // ── Settings ──

  async getSettings(): Promise<PlatformSettings> {
    return this.request<PlatformSettings>('/admin/settings');
  }

  async updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    return this.request<PlatformSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) });
  }

  // ── Occasion Collections ──

  async configureOccasionCollection(config: OccasionCollectionConfig): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/occasions/${config.occasionId}/collection`, { method: 'POST', body: JSON.stringify(config) });
  }
}

// ── Error Class ──

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}
