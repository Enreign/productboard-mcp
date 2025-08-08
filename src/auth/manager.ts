import {
  AuthManagerInterface,
  AuthenticationType,
  Credentials,
  AuthHeaders,
  AuthConfig,
  OAuth2Config,
} from './types.js';
import { BearerTokenAuth } from './bearer.js';
import { OAuth2Auth } from './oauth2.js';
import { SecureCredentialStore } from './store.js';
import { ProductboardAPIError } from '@api/errors.js';
import { Logger } from '@utils/logger.js';

export class AuthenticationManager implements AuthManagerInterface {
  private authType: AuthenticationType;
  private store: SecureCredentialStore;
  private bearerAuth?: BearerTokenAuth;
  private oauth2Auth?: OAuth2Auth;
  private logger: Logger;
  private baseUrl: string;

  constructor(config: AuthConfig, logger: Logger) {
    this.authType = config.type;
    this.store = new SecureCredentialStore();
    this.logger = logger;
    this.baseUrl = config.baseUrl || 'https://api.productboard.com/v1';

    this.initializeAuthHandlers(config);
  }

  private initializeAuthHandlers(config: AuthConfig): void {
    if (config.type === AuthenticationType.BEARER_TOKEN) {
      this.bearerAuth = new BearerTokenAuth(this.baseUrl);
    } else if (config.type === AuthenticationType.OAUTH2) {
      if (!config.credentials.clientId || !config.credentials.clientSecret) {
        throw new ProductboardAPIError(
          'OAuth2 credentials (clientId and clientSecret) are required',
          'AUTH_CONFIG_ERROR',
        );
      }

      const oauth2Config: OAuth2Config = {
        clientId: config.credentials.clientId,
        clientSecret: config.credentials.clientSecret,
        authorizationEndpoint: config.authorizationEndpoint || `${this.baseUrl}/oauth/authorize`,
        tokenEndpoint: config.tokenEndpoint || `${this.baseUrl}/oauth/token`,
        redirectUri: 'http://localhost:3000/callback',
      };

      this.oauth2Auth = new OAuth2Auth(oauth2Config);
    }
  }

  setCredentials(credentials: Credentials): void {
    this.store.setCredentials(credentials);
    this.logger.debug('Credentials updated');
  }

  async validateCredentials(): Promise<boolean> {
    const credentials = this.store.getCredentials();
    if (!credentials) {
      throw new ProductboardAPIError('No credentials set', 'AUTH_NO_CREDENTIALS');
    }

    try {
      if (this.authType === AuthenticationType.BEARER_TOKEN) {
        if (!credentials.token) {
          throw new ProductboardAPIError('Bearer token is required', 'AUTH_NO_TOKEN');
        }
        return await this.bearerAuth!.validateToken(credentials.token);
      } else if (this.authType === AuthenticationType.OAUTH2) {
        if (this.store.isTokenExpired()) {
          await this.refreshCredentials();
        }
        const cache = this.store.getTokenCache();
        return !!cache.accessToken;
      }

      return false;
    } catch (error) {
      this.logger.error('Credential validation failed', error);
      throw error;
    }
  }

  async refreshCredentials(): Promise<void> {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'Token refresh is only available for OAuth2',
        'AUTH_REFRESH_NOT_SUPPORTED',
      );
    }

    const cache = this.store.getTokenCache();
    if (!cache.refreshToken) {
      throw new ProductboardAPIError('No refresh token available', 'AUTH_NO_REFRESH_TOKEN');
    }

    try {
      const tokenResponse = await this.oauth2Auth!.refreshToken(cache.refreshToken);
      this.store.updateAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
      if (tokenResponse.refresh_token) {
        this.store.updateRefreshToken(tokenResponse.refresh_token);
      }
      this.logger.info('OAuth2 tokens refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh OAuth2 tokens', error);
      throw error;
    }
  }

  getAuthHeaders(): AuthHeaders {
    const credentials = this.store.getCredentials();
    if (!credentials) {
      throw new ProductboardAPIError('No credentials set', 'AUTH_NO_CREDENTIALS');
    }

    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      if (!credentials.token) {
        throw new ProductboardAPIError('Bearer token is required', 'AUTH_NO_TOKEN');
      }
      return this.bearerAuth!.getHeaders(credentials.token);
    } else if (this.authType === AuthenticationType.OAUTH2) {
      const cache = this.store.getTokenCache();
      if (!cache.accessToken) {
        throw new ProductboardAPIError('No access token available', 'AUTH_NO_ACCESS_TOKEN');
      }
      return this.oauth2Auth!.getHeaders(cache.accessToken);
    }

    throw new ProductboardAPIError('Unsupported authentication type', 'AUTH_TYPE_ERROR');
  }

  isTokenExpired(): boolean {
    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      return false;
    }
    return this.store.isTokenExpired();
  }

  getTokenExpiry(): Date | null {
    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      return null;
    }
    return this.store.getTokenExpiry();
  }

  async handleOAuth2Callback(code: string, state: string): Promise<void> {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'OAuth2 callback is only available for OAuth2 authentication',
        'AUTH_CALLBACK_NOT_SUPPORTED',
      );
    }

    if (!this.oauth2Auth!.validateState(state)) {
      throw new ProductboardAPIError('Invalid OAuth2 state parameter', 'AUTH_INVALID_STATE');
    }

    try {
      const tokenResponse = await this.oauth2Auth!.exchangeCodeForToken(code);
      this.store.updateAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
      if (tokenResponse.refresh_token) {
        this.store.updateRefreshToken(tokenResponse.refresh_token);
      }
      this.logger.info('OAuth2 authorization completed successfully');
    } catch (error) {
      this.logger.error('OAuth2 callback failed', error);
      throw error;
    }
  }

  getOAuth2AuthorizationUrl(): string {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'Authorization URL is only available for OAuth2',
        'AUTH_URL_NOT_SUPPORTED',
      );
    }
    return this.oauth2Auth!.getAuthorizationUrl();
  }
}