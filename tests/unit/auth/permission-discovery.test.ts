import { PermissionDiscoveryService } from '../../../src/auth/permission-discovery.js';
import { ProductboardAPIClient } from '../../../src/api/client.js';
import { Logger } from '../../../src/utils/logger.js';
import { APIAuthorizationError, APINotFoundError, APIValidationError } from '../../../src/api/errors.js';
import { Permission, AccessLevel } from '../../../src/auth/permissions.js';

describe('PermissionDiscoveryService', () => {
  let service: PermissionDiscoveryService;
  let mockApiClient: jest.Mocked<Pick<ProductboardAPIClient, 'get' | 'post' | 'put' | 'delete'>>;
  let mockLogger: jest.Mocked<Pick<Logger, 'info' | 'debug' | 'error' | 'warn'>>;

  beforeEach(() => {
    mockApiClient = {
      get: jest.fn() as any,
      post: jest.fn() as any,
      put: jest.fn() as any,
      delete: jest.fn() as any,
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    service = new PermissionDiscoveryService(
      mockApiClient as any,
      mockLogger as any
    );
  });

  describe('discoverUserPermissions', () => {
    it('should detect read-only access when only GET requests succeed', async () => {
      // Mock GET requests to succeed for most endpoints, but fail for analytics (admin endpoints)
      mockApiClient.get?.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/analytics')) {
          return Promise.reject(new APIAuthorizationError('Forbidden'));
        }
        return Promise.resolve({ data: [] });
      });
      
      // Mock write operations to fail with authorization errors
      mockApiClient.post?.mockRejectedValue(new APIAuthorizationError('Forbidden'));
      mockApiClient.put?.mockRejectedValue(new APIAuthorizationError('Forbidden'));
      mockApiClient.delete?.mockRejectedValue(new APIAuthorizationError('Forbidden'));

      const permissions = await service.discoverUserPermissions();

      expect(permissions.accessLevel).toBe(AccessLevel.READ);
      expect(permissions.isReadOnly).toBe(true);
      expect(permissions.canWrite).toBe(false);
      expect(permissions.canDelete).toBe(false);
      expect(permissions.isAdmin).toBe(false);
      
      // Should have read permissions
      expect(permissions.permissions.has(Permission.FEATURES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.PRODUCTS_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.NOTES_READ)).toBe(true);
      
      // Should not have write permissions
      expect(permissions.permissions.has(Permission.FEATURES_WRITE)).toBe(false);
      expect(permissions.permissions.has(Permission.PRODUCTS_WRITE)).toBe(false);
    });

    it('should detect write access when POST requests succeed', async () => {
      // Mock GET and POST requests to succeed, but analytics should fail for non-admin
      mockApiClient.get?.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/analytics')) {
          return Promise.reject(new APIAuthorizationError('Forbidden'));
        }
        return Promise.resolve({ data: [] });
      });
      mockApiClient.post?.mockResolvedValue({ data: { id: 'test-id' } });
      
      // Mock delete operations to fail
      mockApiClient.delete?.mockRejectedValue(new APIAuthorizationError('Forbidden'));

      const permissions = await service.discoverUserPermissions();

      expect(permissions.accessLevel).toBe(AccessLevel.WRITE);
      expect(permissions.isReadOnly).toBe(false);
      expect(permissions.canWrite).toBe(true);
      expect(permissions.canDelete).toBe(false);
      
      // Should have both read and write permissions
      expect(permissions.permissions.has(Permission.FEATURES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.FEATURES_WRITE)).toBe(true);
      expect(permissions.permissions.has(Permission.PRODUCTS_WRITE)).toBe(true);
      expect(permissions.permissions.has(Permission.NOTES_WRITE)).toBe(true);
    });

    it('should detect admin access when analytics endpoints succeed', async () => {
      // Mock all requests to succeed
      mockApiClient.get?.mockResolvedValue({ data: [] });
      mockApiClient.post?.mockResolvedValue({ data: { id: 'test-id' } });
      mockApiClient.delete?.mockResolvedValue(undefined);

      const permissions = await service.discoverUserPermissions();

      expect(permissions.accessLevel).toBe(AccessLevel.ADMIN);
      expect(permissions.isAdmin).toBe(true);
      expect(permissions.canWrite).toBe(true);
      
      // Should have analytics permissions
      expect(permissions.permissions.has(Permission.ANALYTICS_READ)).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      // Mock GET to succeed
      mockApiClient.get?.mockResolvedValue({ data: [] });
      
      // Mock POST to fail with validation error (not a permission issue)
      mockApiClient.post?.mockRejectedValue(new APIValidationError('Invalid data'));

      const permissions = await service.discoverUserPermissions();

      // Should still be able to read
      expect(permissions.permissions.has(Permission.FEATURES_READ)).toBe(true);
      
      // Validation errors shouldn't affect permission detection
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Validation error - invalid test data')
      );
    });

    it('should handle 404 errors for non-existent endpoints', async () => {
      // Mock most endpoints to succeed
      mockApiClient.get?.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/analytics')) {
          return Promise.reject(new APINotFoundError('Not found'));
        }
        return Promise.resolve({ data: [] });
      });
      
      mockApiClient.post?.mockResolvedValue({ data: { id: 'test-id' } });

      const permissions = await service.discoverUserPermissions();

      // Should still detect other permissions correctly
      expect(permissions.permissions.has(Permission.FEATURES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.FEATURES_WRITE)).toBe(true);
      
      // Analytics should not be available
      expect(permissions.permissions.has(Permission.ANALYTICS_READ)).toBe(false);
    });

    it('should clean up test resources created during discovery', async () => {
      // Mock successful creation and deletion
      mockApiClient.get?.mockResolvedValue({ data: [] });
      mockApiClient.post?.mockResolvedValue({ data: { id: 'test-resource-id' } });
      mockApiClient.delete?.mockResolvedValue(undefined);

      await service.discoverUserPermissions();

      // Should attempt to delete test resources created
      expect(mockApiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('test-resource-id')
      );
    });

    it('should build comprehensive capabilities object', async () => {
      // Mock partial permissions
      mockApiClient.get?.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/webhooks') || endpoint.includes('/analytics')) {
          return Promise.reject(new APIAuthorizationError('Forbidden'));
        }
        return Promise.resolve({ data: [] });
      });
      
      mockApiClient.post?.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/webhooks')) {
          return Promise.reject(new APIAuthorizationError('Forbidden'));
        }
        return Promise.resolve({ data: { id: 'test-id' } });
      });

      const permissions = await service.discoverUserPermissions();

      // Check capabilities structure
      expect(permissions.capabilities.features.read).toBe(true);
      expect(permissions.capabilities.features.write).toBe(true);
      expect(permissions.capabilities.webhooks.read).toBe(false);
      expect(permissions.capabilities.webhooks.write).toBe(false);
      expect(permissions.capabilities.analytics.read).toBe(false);
      expect(permissions.capabilities.search.enabled).toBe(true);
      expect(permissions.capabilities.bulk.operations).toBe(true); // Has write access
    });

    it('should include delay between tests to avoid rate limiting', async () => {
      // Mock all requests
      mockApiClient.get?.mockResolvedValue({ data: [] });
      mockApiClient.post?.mockResolvedValue({ data: { id: 'test-id' } });

      const startTime = Date.now();
      await service.discoverUserPermissions();
      const endTime = Date.now();

      // Should take at least some time due to delays
      expect(endTime - startTime).toBeGreaterThan(100); // At least 100ms for delays
    });
  });
});