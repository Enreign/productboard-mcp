export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

export enum Permission {
  // User permissions
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_ADMIN = 'users:admin',

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

  // Company permissions
  COMPANIES_READ = 'companies:read',
  COMPANIES_WRITE = 'companies:write',

  // Objective permissions
  OBJECTIVES_READ = 'objectives:read',
  OBJECTIVES_WRITE = 'objectives:write',
  OBJECTIVES_DELETE = 'objectives:delete',

  // Release permissions
  RELEASES_READ = 'releases:read',
  RELEASES_WRITE = 'releases:write',
  RELEASES_DELETE = 'releases:delete',

  // Custom field permissions
  CUSTOM_FIELDS_READ = 'custom_fields:read',
  CUSTOM_FIELDS_WRITE = 'custom_fields:write',
  CUSTOM_FIELDS_DELETE = 'custom_fields:delete',

  // Webhook permissions
  WEBHOOKS_READ = 'webhooks:read',
  WEBHOOKS_WRITE = 'webhooks:write',
  WEBHOOKS_DELETE = 'webhooks:delete',

  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',

  // Integration permissions
  INTEGRATIONS_READ = 'integrations:read',
  INTEGRATIONS_WRITE = 'integrations:write',

  // Export permissions
  EXPORT_DATA = 'export:data',

  // Bulk operation permissions
  BULK_OPERATIONS = 'bulk:operations',

  // Search permissions
  SEARCH = 'search'
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
    users: {
      read: boolean;
      write: boolean;
      admin: boolean;
    };
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
    companies: {
      read: boolean;
      write: boolean;
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
    customFields: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    webhooks: {
      read: boolean;
      write: boolean;
      delete: boolean;
    };
    analytics: {
      read: boolean;
    };
    integrations: {
      read: boolean;
      write: boolean;
    };
    export: {
      data: boolean;
    };
    bulk: {
      operations: boolean;
    };
    search: {
      enabled: boolean;
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