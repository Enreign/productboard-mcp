import { BaseTool } from '../../../src/tools/base.js';
import { ProductboardAPIClient } from '../../../src/api/client.js';
import { Logger } from '../../../src/utils/logger.js';
import { Permission, AccessLevel, UserPermissions } from '../../../src/auth/permissions.js';

// Test implementation of BaseTool
class TestTool extends BaseTool<{ test: string }> {
  constructor(
    apiClient: ProductboardAPIClient,
    logger: Logger,
    requiredPermissions: Permission[],
    minimumAccessLevel: AccessLevel
  ) {
    super(
      'test_tool',
      'Test tool for permission testing',
      {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      },
      {
        requiredPermissions,
        minimumAccessLevel,
        description: 'Test tool permission requirements'
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: { test: string }): Promise<unknown> {
    return { success: true, test: params.test };
  }
}

describe('BaseTool Permission System', () => {
  let mockApiClient: jest.Mocked<Partial<ProductboardAPIClient>>;
  let mockLogger: jest.Mocked<Partial<Logger>>;

  beforeEach(() => {
    mockApiClient = {};
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
  });

  describe('isAvailableForUser', () => {
    it('should allow access when user has all required permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ],
        AccessLevel.READ
      );

      const userPermissions: UserPermissions = {
        accessLevel: AccessLevel.WRITE,
        isReadOnly: false,
        canWrite: true,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.FEATURES_READ, Permission.FEATURES_WRITE]),
        capabilities: {} as any
      };

      expect(tool.isAvailableForUser(userPermissions)).toBe(true);
    });

    it('should deny access when user lacks required permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_WRITE],
        AccessLevel.WRITE
      );

      const userPermissions: UserPermissions = {
        accessLevel: AccessLevel.READ,
        isReadOnly: true,
        canWrite: false,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.FEATURES_READ]),
        capabilities: {} as any
      };

      expect(tool.isAvailableForUser(userPermissions)).toBe(false);
    });

    it('should deny access when user has insufficient access level', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.ANALYTICS_READ],
        AccessLevel.ADMIN
      );

      const userPermissions: UserPermissions = {
        accessLevel: AccessLevel.WRITE,
        isReadOnly: false,
        canWrite: true,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.ANALYTICS_READ]), // Has permission but not access level
        capabilities: {} as any
      };

      expect(tool.isAvailableForUser(userPermissions)).toBe(false);
    });

    it('should handle multiple required permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ, Permission.PRODUCTS_READ, Permission.NOTES_READ],
        AccessLevel.READ
      );

      const userPermissionsPartial: UserPermissions = {
        accessLevel: AccessLevel.READ,
        isReadOnly: true,
        canWrite: false,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.FEATURES_READ, Permission.PRODUCTS_READ]), // Missing NOTES_READ
        capabilities: {} as any
      };

      const userPermissionsComplete: UserPermissions = {
        ...userPermissionsPartial,
        permissions: new Set([Permission.FEATURES_READ, Permission.PRODUCTS_READ, Permission.NOTES_READ])
      };

      expect(tool.isAvailableForUser(userPermissionsPartial)).toBe(false);
      expect(tool.isAvailableForUser(userPermissionsComplete)).toBe(true);
    });
  });

  describe('getMissingPermissions', () => {
    it('should return empty array when user has all permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ, Permission.FEATURES_WRITE],
        AccessLevel.WRITE
      );

      const userPermissions: UserPermissions = {
        accessLevel: AccessLevel.WRITE,
        isReadOnly: false,
        canWrite: true,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.FEATURES_READ, Permission.FEATURES_WRITE]),
        capabilities: {} as any
      };

      expect(tool.getMissingPermissions(userPermissions)).toEqual([]);
    });

    it('should return missing permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_WRITE, Permission.PRODUCTS_WRITE, Permission.NOTES_WRITE],
        AccessLevel.WRITE
      );

      const userPermissions: UserPermissions = {
        accessLevel: AccessLevel.WRITE,
        isReadOnly: false,
        canWrite: true,
        canDelete: false,
        isAdmin: false,
        permissions: new Set([Permission.FEATURES_WRITE]), // Missing PRODUCTS_WRITE and NOTES_WRITE
        capabilities: {} as any
      };

      const missing = tool.getMissingPermissions(userPermissions);
      expect(missing).toHaveLength(2);
      expect(missing).toContain(Permission.PRODUCTS_WRITE);
      expect(missing).toContain(Permission.NOTES_WRITE);
    });
  });

  describe('getRequiredAccessLevel', () => {
    it('should return the minimum access level', () => {
      const readTool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ],
        AccessLevel.READ
      );

      const writeTool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_WRITE],
        AccessLevel.WRITE
      );

      const adminTool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.WEBHOOKS_WRITE],
        AccessLevel.ADMIN
      );

      expect(readTool.getRequiredAccessLevel()).toBe(AccessLevel.READ);
      expect(writeTool.getRequiredAccessLevel()).toBe(AccessLevel.WRITE);
      expect(adminTool.getRequiredAccessLevel()).toBe(AccessLevel.ADMIN);
    });
  });

  describe('getRequiredPermissions', () => {
    it('should return all required permissions', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ, Permission.PRODUCTS_READ, Permission.SEARCH],
        AccessLevel.READ
      );

      const required = tool.getRequiredPermissions();
      expect(required).toHaveLength(3);
      expect(required).toContain(Permission.FEATURES_READ);
      expect(required).toContain(Permission.PRODUCTS_READ);
      expect(required).toContain(Permission.SEARCH);
    });

    it('should return a copy of permissions array', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_READ],
        AccessLevel.READ
      );

      const required1 = tool.getRequiredPermissions();
      const required2 = tool.getRequiredPermissions();

      expect(required1).not.toBe(required2); // Different array instances
      expect(required1).toEqual(required2); // Same content
    });
  });

  describe('getMetadata', () => {
    it('should include permission metadata', () => {
      const tool = new TestTool(
        mockApiClient as any,
        mockLogger as any,
        [Permission.FEATURES_WRITE],
        AccessLevel.WRITE
      );

      const metadata = tool.getMetadata();

      expect(metadata.name).toBe('test_tool');
      expect(metadata.description).toBe('Test tool for permission testing');
      expect(metadata.permissions).toEqual({
        requiredPermissions: [Permission.FEATURES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Test tool permission requirements'
      });
    });
  });
});