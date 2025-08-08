export enum AuthenticationType {
  BEARER_TOKEN = 'bearer',
  OAUTH2 = 'oauth2',
}

export interface AuthHeaders {
  Authorization: string;
  [key: string]: string;
}

export interface Credentials {
  type: AuthenticationType;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface AuthConfig {
  type: AuthenticationType;
  credentials: Credentials;
  baseUrl?: string;
  tokenEndpoint?: string;
  authorizationEndpoint?: string;
}

export interface TokenCache {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface AuthManagerInterface {
  setCredentials(credentials: Credentials): void;
  validateCredentials(): Promise<boolean>;
  refreshCredentials(): Promise<void>;
  getAuthHeaders(): AuthHeaders;
  isTokenExpired(): boolean;
  getTokenExpiry(): Date | null;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope?: string;
}