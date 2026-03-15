/** Shared interfaces used across multiple services */

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: 'user' | 'partner' | 'admin';
  iat: number;
  exp: number;
}
