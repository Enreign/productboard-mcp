export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

export enum Permission {
  // Feature permissions
  FEATURES_READ = 'features:read',
  FEATURES_WRITE = 'features:write',
  FEATURES_DELETE = 'features:delete',

  // Product permissions
  PRODUCTS_READ = 'products:read',
  PRODUCTS_WRITE = 'products:write',
  PRODUCTS_DELETE = 'products:delete',

  // Note permissions
  NOTES_READ = 'notes:read',
  NOTES_WRITE = 'notes:write',
  NOTES_DELETE = 'notes:delete',

  // Objective permissions
  OBJECTIVES_READ = 'objectives:read',
  OBJECTIVES_WRITE = 'objectives:write',
  OBJECTIVES_DELETE = 'objectives:delete',

  // Release permissions
  RELEASES_READ = 'releases:read',
  RELEASES_WRITE = 'releases:write',
  RELEASES_DELETE = 'releases:delete',
}

export interface UserPermissions {
  // Access levels
  accessLevel: AccessLevel;
  isReadOnly: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isAdmin: boolean;

  // Specific permissions
  permissions: Set<Permission>;

  // Resource-specific capabilities
  capabilities: {
    features: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    products: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    notes: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    objectives: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    releases: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
  };
}

export interface ToolPermissionMetadata {
  requiredPermissions: Permission[];
  minimumAccessLevel: AccessLevel;
  description: string;
}

export interface PermissionTestResult {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  success: boolean;
  statusCode?: number;
  error?: string;
}
