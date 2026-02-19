import { PermissionDiscoveryService } from '../../../src/auth/permission-discovery.js';
import { ProductboardAPIClient } from '../../../src/api/client.js';
import { Logger } from '../../../src/utils/logger.js';
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

  // Note: discoverUserPermissions() currently has an early return that skips
  // API-based permission discovery and returns read-only permissions via
  // createReadOnlyUserPermissions(). All tests verify this read-only behavior.

  describe('discoverUserPermissions', () => {
    it('should return read-only permissions', async () => {
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

    it('should not make any API calls', async () => {
      await service.discoverUserPermissions();

      // Early return means no API calls are made
      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(mockApiClient.post).not.toHaveBeenCalled();
      expect(mockApiClient.put).not.toHaveBeenCalled();
      expect(mockApiClient.delete).not.toHaveBeenCalled();
    });

    it('should log that permission discovery is skipped', async () => {
      await service.discoverUserPermissions();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping permission discovery - assuming read-only access'
      );
    });

    it('should build comprehensive capabilities object', async () => {
      const permissions = await service.discoverUserPermissions();

      // Check capabilities structure matches read-only defaults
      expect(permissions.capabilities.features.read).toBe(true);
      expect(permissions.capabilities.features.write).toBe(false);
      expect(permissions.capabilities.webhooks.read).toBe(true);
      expect(permissions.capabilities.webhooks.write).toBe(false);
      expect(permissions.capabilities.analytics.read).toBe(false);
      expect(permissions.capabilities.search.enabled).toBe(true);
      expect(permissions.capabilities.bulk.operations).toBe(false);
    });

    it('should include all expected read permissions', async () => {
      const permissions = await service.discoverUserPermissions();

      expect(permissions.permissions.has(Permission.USERS_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.FEATURES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.PRODUCTS_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.NOTES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.COMPANIES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.OBJECTIVES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.RELEASES_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.CUSTOM_FIELDS_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.WEBHOOKS_READ)).toBe(true);
      expect(permissions.permissions.has(Permission.SEARCH)).toBe(true);
      expect(permissions.permissions.has(Permission.INTEGRATIONS_READ)).toBe(true);
    });

    it('should not include analytics permissions', async () => {
      const permissions = await service.discoverUserPermissions();

      expect(permissions.permissions.has(Permission.ANALYTICS_READ)).toBe(false);
    });
  });
});
