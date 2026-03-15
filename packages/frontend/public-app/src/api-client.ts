/**
 * Public App API Client
 * Typed HTTP client for all public-facing API endpoints
 */
import {
  PaginatedResult,
  AuthTokens,
  AgeGroup,
  GiftCardStatus,
  BookingStatus,
  FulfillmentStatus,
  MomentStatus,
} from '@experience-gift/shared-types';

// ── View Models ──

export interface ExperienceListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  ageGroups: AgeGroup[];
  partnerName: string;
  location: string;
}

export interface ExperienceDetail extends ExperienceListItem {
  fullDescription: string;
  availableDates: string[];
  availableTimes: string[];
  capacity: number;
  partnerId: string;
  occasions: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface GiftCardTemplate {
  id: string;
  occasionId: string;
  name: string;
  previewUrl: string;
}

export interface CuratedCollection {
  id: string;
  occasionId: string;
  title: string;
  experiences: ExperienceListItem[];
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface CreateOrderRequest {
  experienceId: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  occasion: string;
  occasionTemplateId?: string;
  personalizedMessage?: string;
  ageGroupContext?: string;
  wishlistItemId?: string;
}

export interface OrderResponse {
  id: string;
  referenceNumber: string;
  experienceId: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail: string;
  occasion: string;
  personalizedMessage?: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

export interface PayOrderRequest {
  paymentMethodId: string;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  clientSecret?: string;
  requiresAction?: boolean;
}

export interface OrderStatus {
  referenceNumber: string;
  status: string;
  giftCardStatus?: GiftCardStatus;
  bookingStatus?: BookingStatus;
  bookingDate?: string;
  bookingTime?: string;
  experienceName?: string;
}

export interface ValidateCodeResponse {
  giftCardId: string;
  experienceId: string;
  experienceName: string;
  experienceDescription: string;
  personalizedMessage?: string;
  availableDates: string[];
  availableTimes: string[];
  location: string;
}

export interface RedeemRequest {
  redemptionCode: string;
  bookingDate: string;
  bookingTime: string;
}

export interface RedeemResponse {
  bookingId: string;
  giftCardId: string;
  experienceName: string;
  bookingDate: string;
  bookingTime: string;
  location: string;
  confirmationNumber: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface WishlistSummary {
  id: string;
  name: string;
  shareToken: string;
  itemCount: number;
  fulfilledCount: number;
  createdAt: string;
}

export interface WishlistDetail {
  id: string;
  name: string;
  shareToken: string;
  userId: string;
  items: WishlistItem[];
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  experienceId: string;
  experienceName: string;
  experienceImageUrl: string;
  price: number;
  note?: string;
  fulfillmentStatus: FulfillmentStatus;
}

export interface SharedWishlistView {
  id: string;
  name: string;
  items: Array<{
    id: string;
    experienceId: string;
    experienceName: string;
    experienceImageUrl: string;
    price: number;
    note?: string;
  }>;
}

export interface CommunityImpact {
  totalFamilies: number;
  experiencesGifted: number;
  estimatedFamilyHours: number;
  materialGiftsReplaced: number;
}

export interface UserImpact {
  userId: string;
  experiencesGifted: number;
  materialGiftsReplaced: number;
  familyHoursCreated: number;
}

export interface ImpactBadge {
  userId: string;
  badgeUrl: string;
  experiencesGifted: number;
  shareText: string;
}

export interface SharedMoment {
  id: string;
  experienceName: string;
  photoUrl: string;
  caption: string;
  publishedAt: string;
  status: MomentStatus;
}

export interface SubmitMomentRequest {
  bookingId: string;
  photoKey: string;
  caption: string;
  consentGiven: boolean;
  isMinor?: boolean;
  guardianEmail?: string;
}

export interface SharingPrompt {
  bookingId: string;
  experienceName: string;
  bookingDate: string;
  promptText: string;
}

// ── API Client ──

export class PublicApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken?: () => string | null,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as Record<string, any>)) as Record<string, any>;
      throw new ApiError(response.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? response.statusText);
    }

    return response.json() as Promise<T>;
  }

  // ── Auth ──

  async register(data: RegisterRequest): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  }

  async login(data: LoginRequest): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/token/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  }

  // ── Catalog ──

  async listExperiences(filters?: {
    category?: string;
    ageGroup?: string;
    occasion?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<ExperienceListItem>> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.ageGroup) params.set('ageGroup', filters.ageGroup);
    if (filters?.occasion) params.set('occasion', filters.occasion);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return this.request<PaginatedResult<ExperienceListItem>>(`/catalog/experiences${qs ? `?${qs}` : ''}`);
  }

  async getExperience(id: string): Promise<ExperienceDetail> {
    return this.request<ExperienceDetail>(`/catalog/experiences/${id}`);
  }

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/catalog/categories');
  }

  async getOccasions(): Promise<Occasion[]> {
    return this.request<Occasion[]>('/catalog/occasions');
  }

  async getOccasionCollection(occasionId: string, date?: string): Promise<CuratedCollection> {
    const qs = date ? `?date=${date}` : '';
    return this.request<CuratedCollection>(`/catalog/occasions/${occasionId}/collection${qs}`);
  }

  async getOccasionTemplates(occasionId: string): Promise<GiftCardTemplate[]> {
    return this.request<GiftCardTemplate[]>(`/catalog/occasions/${occasionId}/templates`);
  }

  // ── Orders ──

  async createOrder(data: CreateOrderRequest): Promise<OrderResponse> {
    return this.request<OrderResponse>('/orders', { method: 'POST', body: JSON.stringify(data) });
  }

  async payOrder(orderId: string, data: PayOrderRequest): Promise<PaymentResult> {
    return this.request<PaymentResult>(`/orders/${orderId}/pay`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getOrderStatus(referenceNumber: string, purchaserEmail: string): Promise<OrderStatus> {
    const params = new URLSearchParams({ referenceNumber, purchaserEmail });
    return this.request<OrderStatus>(`/orders/status?${params}`);
  }

  async resendOrder(orderId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/orders/${orderId}/resend`, { method: 'POST' });
  }

  // ── Gift Card Redemption ──

  async validateRedemptionCode(code: string): Promise<ValidateCodeResponse> {
    return this.request<ValidateCodeResponse>('/gift-cards/validate', { method: 'POST', body: JSON.stringify({ redemptionCode: code }) });
  }

  async redeemGiftCard(data: RedeemRequest): Promise<RedeemResponse> {
    return this.request<RedeemResponse>('/gift-cards/redeem', { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Wishlists ──

  async createWishlist(name: string): Promise<WishlistDetail> {
    return this.request<WishlistDetail>('/wishlists', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async getWishlist(id: string): Promise<WishlistDetail> {
    return this.request<WishlistDetail>(`/wishlists/${id}`);
  }

  async getSharedWishlist(shareToken: string): Promise<SharedWishlistView> {
    return this.request<SharedWishlistView>(`/wishlists/share/${shareToken}`);
  }

  async getUserWishlists(userId: string): Promise<WishlistSummary[]> {
    return this.request<WishlistSummary[]>(`/wishlists/user/${userId}`);
  }

  async addWishlistItem(wishlistId: string, experienceId: string, note?: string): Promise<WishlistItem> {
    return this.request<WishlistItem>(`/wishlists/${wishlistId}/items`, { method: 'POST', body: JSON.stringify({ experienceId, note }) });
  }

  async removeWishlistItem(wishlistId: string, itemId: string): Promise<void> {
    await this.request<void>(`/wishlists/${wishlistId}/items/${itemId}`, { method: 'DELETE' });
  }

  // ── Community ──

  async getCommunityImpact(): Promise<CommunityImpact> {
    return this.request<CommunityImpact>('/community/impact');
  }

  async getUserImpact(userId: string): Promise<UserImpact> {
    return this.request<UserImpact>(`/community/impact/user/${userId}`);
  }

  async getImpactBadge(userId: string): Promise<ImpactBadge> {
    return this.request<ImpactBadge>(`/community/impact/user/${userId}/badge`);
  }

  async getCommunityFeed(page?: number, limit?: number): Promise<PaginatedResult<SharedMoment>> {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return this.request<PaginatedResult<SharedMoment>>(`/community/feed${qs ? `?${qs}` : ''}`);
  }

  async submitMoment(data: SubmitMomentRequest): Promise<SharedMoment> {
    return this.request<SharedMoment>('/community/moments', { method: 'POST', body: JSON.stringify(data) });
  }

  async approveMoment(momentId: string): Promise<SharedMoment> {
    return this.request<SharedMoment>(`/community/moments/${momentId}/approve`, { method: 'POST' });
  }

  async getSharingPrompt(bookingId: string): Promise<SharingPrompt> {
    return this.request<SharingPrompt>(`/community/moments/prompt/${bookingId}`);
  }
}

// ── Error Class ──

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
