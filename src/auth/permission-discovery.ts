import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import {
  UserPermissions,
  AccessLevel,
  Permission,
} from './permissions.js';

export class PermissionDiscoveryService {
  private apiClient: ProductboardAPIClient;
  private logger: Logger;

  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  async discoverUserPermissions(): Promise<UserPermissions> {
    // Decode permissions from JWT token rather than making risky write API calls
    const tokenRole = this.extractRoleFromToken();
    if (tokenRole) {
      this.logger.info(`Discovered role from token: ${tokenRole}`);
      return this.createPermissionsFromRole(tokenRole);
    }

    this.logger.info("Skipping permission discovery - assuming read-only access");
    return this.createReadOnlyUserPermissions();
  }

  private extractRoleFromToken(): string | null {
    try {
      const config = this.apiClient.getConfig();
      const token = (config as any).token || process.env.PRODUCTBOARD_API_TOKEN;
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      return payload.role || null;
    } catch {
      return null;
    }
  }

  private createPermissionsFromRole(role: string): UserPermissions {
    const isAdmin = role === 'admin';
    const canWrite = isAdmin || role === 'contributor' || role === 'editor';
    const canDelete = isAdmin;

    const permissions = new Set<Permission>();

    // All roles get read access
    permissions.add(Permission.FEATURES_READ);
    permissions.add(Permission.PRODUCTS_READ);
    permissions.add(Permission.NOTES_READ);
    permissions.add(Permission.OBJECTIVES_READ);
    permissions.add(Permission.RELEASES_READ);

    if (canWrite) {
      permissions.add(Permission.FEATURES_WRITE);
      permissions.add(Permission.PRODUCTS_WRITE);
      permissions.add(Permission.NOTES_WRITE);
      permissions.add(Permission.OBJECTIVES_WRITE);
      permissions.add(Permission.RELEASES_WRITE);
    }

    if (canDelete) {
      permissions.add(Permission.FEATURES_DELETE);
      permissions.add(Permission.PRODUCTS_DELETE);
      permissions.add(Permission.NOTES_DELETE);
      permissions.add(Permission.OBJECTIVES_DELETE);
      permissions.add(Permission.RELEASES_DELETE);
    }

    const accessLevel = isAdmin ? AccessLevel.ADMIN : canWrite ? AccessLevel.WRITE : AccessLevel.READ;

    return {
      permissions,
      accessLevel,
      isReadOnly: !canWrite,
      canWrite,
      canDelete,
      isAdmin,
      capabilities: {
        features: { read: true, write: canWrite, delete: canDelete },
        products: { read: true, write: canWrite, delete: canDelete },
        notes: { read: true, write: canWrite, delete: canDelete },
        objectives: { read: true, write: canWrite, delete: canDelete },
        releases: { read: true, write: canWrite, delete: canDelete },
      },
    };
  }

  private createReadOnlyUserPermissions(): UserPermissions {
    const permissions = new Set<Permission>();

    permissions.add(Permission.FEATURES_READ);
    permissions.add(Permission.PRODUCTS_READ);
    permissions.add(Permission.NOTES_READ);
    permissions.add(Permission.OBJECTIVES_READ);
    permissions.add(Permission.RELEASES_READ);

    return {
      permissions,
      accessLevel: AccessLevel.READ,
      isReadOnly: true,
      canWrite: false,
      canDelete: false,
      isAdmin: false,
      capabilities: {
        features: { read: true, write: false, delete: false },
        products: { read: true, write: false, delete: false },
        notes: { read: true, write: false, delete: false },
        objectives: { read: true, write: false, delete: false },
        releases: { read: true, write: false, delete: false },
      },
    };
  }
}
