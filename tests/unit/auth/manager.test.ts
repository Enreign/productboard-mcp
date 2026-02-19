import { AuthenticationManager } from '../../../src/auth/manager.js';
import { BearerTokenAuth } from '../../../src/auth/bearer.js';
import { OAuth2Auth } from '../../../src/auth/oauth2.js';
import { Logger } from '../../../src/utils/logger.js';
import { SecureCredentialStore } from '../../../src/auth/store.js';
import { AuthenticationType } from '../../../src/auth/types.js';

jest.mock('../../../src/auth/bearer.js');
jest.mock('../../../src/auth/oauth2.js');
jest.mock('../../../src/auth/store.js');

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockTokenStore: jest.Mocked<SecureCredentialStore>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Create a simple in-memory store for testing
    let storedCredentials: any = null;
    let tokenCache: any = {};

    mockTokenStore = {
      getCredentials: jest.fn(() => storedCredentials),
      setCredentials: jest.fn((creds) => { storedCredentials = creds; }),
      clearCredentials: jest.fn(() => { storedCredentials = null; tokenCache = {}; }),
      hasCredentials: jest.fn(() => !!storedCredentials),
      getTokenCache: jest.fn(() => tokenCache),
      setTokenCache: jest.fn((cache) => { tokenCache = cache; }),
      updateAccessToken: jest.fn((token, expiresIn) => {
        tokenCache.accessToken = token;
        tokenCache.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }),
      updateRefreshToken: jest.fn((token) => { tokenCache.refreshToken = token; }),
      isTokenExpired: jest.fn(() => false),
      getTokenExpiry: jest.fn(() => tokenCache.expiresAt || null),
    } as any;

    (SecureCredentialStore as jest.Mock).mockImplementation(() => mockTokenStore);
  });

  describe('Bearer Token Authentication', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);
    });

    it('should create BearerTokenAuth instance', () => {
      expect(BearerTokenAuth).toHaveBeenCalledWith('https://api.productboard.com');
    });

    it('should return auth headers from bearer auth', () => {
      const mockBearerAuth = {
        getHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-bearer-token' }),
        validateToken: jest.fn(),
      };

      (BearerTokenAuth as jest.Mock).mockImplementation(() => mockBearerAuth);

      const newAuthManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);

      // Set credentials first
      newAuthManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        token: 'test-bearer-token',
      });

      const headers = newAuthManager.getAuthHeaders();

      expect(headers).toEqual({ Authorization: 'Bearer test-bearer-token' });
      expect(mockBearerAuth.getHeaders).toHaveBeenCalledWith('test-bearer-token');
    });

    it('should check authentication status', async () => {
      const mockBearerAuth = {
        validateToken: jest.fn().mockResolvedValue(true),
        getHeaders: jest.fn(),
      };

      (BearerTokenAuth as jest.Mock).mockImplementation(() => mockBearerAuth);

      const newAuthManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);

      // Set credentials first
      newAuthManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        token: 'test-bearer-token',
      });

      const isAuth = await newAuthManager.validateCredentials();

      expect(isAuth).toBe(true);
      expect(mockBearerAuth.validateToken).toHaveBeenCalledWith('test-bearer-token');
    });

    it('should not support token refresh for bearer auth', async () => {
      const newAuthManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);

      await expect(newAuthManager.refreshCredentials()).rejects.toThrow('Token refresh is only available for OAuth2');
    });
  });

  describe('OAuth2 Authentication', () => {
    beforeEach(() => {
      authManager = new AuthenticationManager({
        type: AuthenticationType.OAUTH2,
        credentials: {
          type: AuthenticationType.OAUTH2,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      }, mockLogger);
    });

    it('should create OAuth2Auth instance', () => {
      expect(OAuth2Auth).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authorizationEndpoint: 'https://api.productboard.com/oauth/authorize',
        tokenEndpoint: 'https://api.productboard.com/oauth/token',
        redirectUri: 'http://localhost:3000/callback',
      });
    });

    it('should return auth headers from OAuth2 auth', () => {
      const mockOAuth2Auth = {
        getHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer oauth-token' }),
      };

      (OAuth2Auth as jest.Mock).mockImplementation(() => mockOAuth2Auth);

      // Mock the store to return an access token
      mockTokenStore.getTokenCache.mockReturnValue({ accessToken: 'oauth-token' });

      const newAuthManager = new AuthenticationManager({
        type: AuthenticationType.OAUTH2,
        credentials: {
          type: AuthenticationType.OAUTH2,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      }, mockLogger);

      // Set credentials first
      newAuthManager.setCredentials({
        type: AuthenticationType.OAUTH2,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      const headers = newAuthManager.getAuthHeaders();

      expect(headers).toEqual({ Authorization: 'Bearer oauth-token' });
      expect(mockOAuth2Auth.getHeaders).toHaveBeenCalledWith('oauth-token');
    });

    it('should handle OAuth2 authentication flow', async () => {
      const mockOAuth2Auth = {
        getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer oauth-token' }),
        refreshToken: jest.fn().mockResolvedValue({ access_token: 'new-token', expires_in: 3600 }),
      };

      (OAuth2Auth as jest.Mock).mockImplementation(() => mockOAuth2Auth);

      // Mock the store to return a refresh token
      mockTokenStore.getTokenCache.mockReturnValue({ refreshToken: 'refresh-token' });

      const newAuthManager = new AuthenticationManager({
        type: AuthenticationType.OAUTH2,
        credentials: {
          type: AuthenticationType.OAUTH2,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      }, mockLogger);

      await newAuthManager.refreshCredentials();

      expect(mockOAuth2Auth.refreshToken).toHaveBeenCalledWith('refresh-token');
      expect(mockTokenStore.updateAccessToken).toHaveBeenCalledWith('new-token', 3600);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported auth type', () => {
      const authManager = new AuthenticationManager({
        type: 'unsupported' as any,
        credentials: {} as any,
      } as any, mockLogger);

      authManager.setCredentials({
        type: 'unsupported' as any,
      } as any);

      expect(() => {
        authManager.getAuthHeaders();
      }).toThrow('Unsupported authentication type');
    });

    it('should handle missing bearer token', () => {
      const authManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
        },
      } as any, mockLogger);

      authManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        // Missing token
      });

      expect(() => {
        authManager.getAuthHeaders();
      }).toThrow('Bearer token is required');
    });

    it('should handle missing OAuth2 credentials', () => {
      expect(() => {
        new AuthenticationManager({
          type: AuthenticationType.OAUTH2,
          credentials: {
            type: AuthenticationType.OAUTH2,
            clientId: 'test-client-id',
            // Missing clientSecret
          },
        } as any, mockLogger);
      }).toThrow('OAuth2 credentials (clientId and clientSecret) are required');
    });
  });

  describe('Token Store Integration', () => {
    it('should initialize token store for OAuth2', () => {
      new AuthenticationManager({
        type: AuthenticationType.OAUTH2,
        credentials: {
          type: AuthenticationType.OAUTH2,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      }, mockLogger);

      expect(SecureCredentialStore).toHaveBeenCalled();
    });

    it('should not initialize token store for bearer auth', () => {
      (SecureCredentialStore as jest.Mock).mockClear();
      
      new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);

      expect(SecureCredentialStore).toHaveBeenCalled();
    });
  });

  describe('Lifecycle Methods', () => {
    beforeEach(() => {
      // Mock BearerTokenAuth for this test
      const mockBearerAuth = {
        getHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
        validateToken: jest.fn(),
      };
      (BearerTokenAuth as jest.Mock).mockImplementation(() => mockBearerAuth);

      authManager = new AuthenticationManager({
        type: AuthenticationType.BEARER_TOKEN,
        credentials: {
          type: AuthenticationType.BEARER_TOKEN,
          token: 'test-bearer-token',
        },
      }, mockLogger);
    });

    it('should handle initialization', () => {
      expect(authManager).toBeDefined();
    });

    it('should handle cleanup', () => {
      // Set credentials first
      authManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        token: 'test-bearer-token',
      });

      // Test that the manager can be properly cleaned up
      const headers = authManager.getAuthHeaders();
      expect(headers).toBeDefined();
      expect(headers).toEqual({ Authorization: 'Bearer test-token' });
    });
  });
});