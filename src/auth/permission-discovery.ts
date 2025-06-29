import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import {
  UserPermissions,
  AccessLevel,
  Permission,
  PermissionTestResult,
} from './permissions.js';
import {
  APIAuthorizationError,
  APINotFoundError,
  APIValidationError,
} from '@api/errors.js';

export class PermissionDiscoveryService {
  private apiClient: ProductboardAPIClient;
  private logger: Logger;

  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  async discoverUserPermissions(): Promise<UserPermissions> {
    this.logger.info('Starting permission discovery...');

    const testResults = await this.runPermissionTests();
    const permissions = this.analyzeTestResults(testResults);

    this.logger.info('Permission discovery completed', {
      accessLevel: permissions.accessLevel,
      permissionCount: permissions.permissions.size,
      capabilities: permissions.capabilities,
    });

    return permissions;
  }

  private async runPermissionTests(): Promise<PermissionTestResult[]> {
    const tests: Array<{
      endpoint: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      testData?: unknown;
      description: string;
    }> = [
      // User endpoint tests
      { endpoint: '/users/me', method: 'GET', description: 'Read current user' },
      { endpoint: '/users', method: 'GET', description: 'List users' },

      // Feature endpoint tests
      { endpoint: '/features', method: 'GET', description: 'Read features' },
      {
        endpoint: '/features',
        method: 'POST',
        testData: { name: 'Permission Test Feature', description: 'Test' },
        description: 'Create features',
      },

      // Product endpoint tests
      { endpoint: '/products', method: 'GET', description: 'Read products' },
      {
        endpoint: '/products',
        method: 'POST',
        testData: { name: 'Permission Test Product', type: 'product' },
        description: 'Create products',
      },

      // Note endpoint tests
      { endpoint: '/notes', method: 'GET', description: 'Read notes' },
      {
        endpoint: '/notes',
        method: 'POST',
        testData: { content: 'Permission test note' },
        description: 'Create notes',
      },

      // Company endpoint tests
      { endpoint: '/companies', method: 'GET', description: 'Read companies' },

      // Objective endpoint tests
      { endpoint: '/objectives', method: 'GET', description: 'Read objectives' },
      {
        endpoint: '/objectives',
        method: 'POST',
        testData: { name: 'Test Objective', type: 'company' },
        description: 'Create objectives',
      },

      // Release endpoint tests
      { endpoint: '/releases', method: 'GET', description: 'Read releases' },
      {
        endpoint: '/releases',
        method: 'POST',
        testData: { name: 'Test Release' },
        description: 'Create releases',
      },

      // Custom field tests
      { endpoint: '/custom_fields', method: 'GET', description: 'Read custom fields' },
      {
        endpoint: '/custom_fields',
        method: 'POST',
        testData: { name: 'Test Field', type: 'text' },
        description: 'Create custom fields',
      },

      // Webhook tests
      { endpoint: '/webhooks', method: 'GET', description: 'Read webhooks' },
      {
        endpoint: '/webhooks',
        method: 'POST',
        testData: { url: 'https://example.com/webhook', events: ['feature.created'] },
        description: 'Create webhooks',
      },

      // Search test
      { endpoint: '/search?q=test', method: 'GET', description: 'Search functionality' },

      // Analytics tests (typically admin-only)
      { endpoint: '/analytics/features', method: 'GET', description: 'Feature analytics' },
      { endpoint: '/analytics/users', method: 'GET', description: 'User analytics' },
    ];

    const results: PermissionTestResult[] = [];

    for (const test of tests) {
      try {
        this.logger.debug(`Testing ${test.method} ${test.endpoint}...`);

        let response;
        switch (test.method) {
          case 'GET':
            response = await this.apiClient.get(test.endpoint);
            break;
          case 'POST':
            response = await this.apiClient.post(test.endpoint, test.testData || {});
            break;
          case 'PUT':
            response = await this.apiClient.put(test.endpoint, test.testData || {});
            break;
          case 'DELETE':
            await this.apiClient.delete(test.endpoint);
            break;
        }

        results.push({
          endpoint: test.endpoint,
          method: test.method,
          success: true,
          statusCode: 200,
        });

        this.logger.debug(`✓ ${test.description} - Success`);

        // If we created a test resource, try to clean it up
        if (test.method === 'POST' && response && (response as any).data?.id) {
          try {
            const resourceId = (response as any).data.id;
            const baseEndpoint = test.endpoint.split('?')[0];
            await this.apiClient.delete(`${baseEndpoint}/${resourceId}`);
            this.logger.debug(`Cleaned up test resource: ${resourceId}`);
          } catch (cleanupError) {
            // Ignore cleanup errors
            this.logger.debug('Could not clean up test resource (non-critical)');
          }
        }
      } catch (error) {
        let statusCode = 500;
        let errorMessage = 'Unknown error';

        if (error instanceof APIAuthorizationError) {
          statusCode = 403;
          errorMessage = 'Forbidden - insufficient permissions';
        } else if (error instanceof APINotFoundError) {
          statusCode = 404;
          errorMessage = 'Not found - endpoint may not exist';
        } else if (error instanceof APIValidationError) {
          statusCode = 400;
          errorMessage = 'Validation error - invalid test data';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        results.push({
          endpoint: test.endpoint,
          method: test.method,
          success: false,
          statusCode,
          error: errorMessage,
        });

        this.logger.debug(`✗ ${test.description} - ${errorMessage}`);
      }

      // Add small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  private analyzeTestResults(testResults: PermissionTestResult[]): UserPermissions {
    const permissions = new Set<Permission>();
    
    // Helper function to check if an endpoint test succeeded
    const canAccess = (endpoint: string, method: string): boolean => {
      return testResults.some(
        result => 
          result.endpoint.includes(endpoint) && 
          result.method === method && 
          result.success
      );
    };

    // Analyze user permissions
    const usersRead = canAccess('/users', 'GET');
    const usersWrite = canAccess('/users', 'POST');
    if (usersRead) permissions.add(Permission.USERS_READ);
    if (usersWrite) permissions.add(Permission.USERS_WRITE);

    // Analyze feature permissions
    const featuresRead = canAccess('/features', 'GET');
    const featuresWrite = canAccess('/features', 'POST');
    if (featuresRead) permissions.add(Permission.FEATURES_READ);
    if (featuresWrite) permissions.add(Permission.FEATURES_WRITE);

    // Analyze product permissions
    const productsRead = canAccess('/products', 'GET');
    const productsWrite = canAccess('/products', 'POST');
    if (productsRead) permissions.add(Permission.PRODUCTS_READ);
    if (productsWrite) permissions.add(Permission.PRODUCTS_WRITE);

    // Analyze note permissions
    const notesRead = canAccess('/notes', 'GET');
    const notesWrite = canAccess('/notes', 'POST');
    if (notesRead) permissions.add(Permission.NOTES_READ);
    if (notesWrite) permissions.add(Permission.NOTES_WRITE);

    // Analyze company permissions
    const companiesRead = canAccess('/companies', 'GET');
    if (companiesRead) permissions.add(Permission.COMPANIES_READ);

    // Analyze objective permissions
    const objectivesRead = canAccess('/objectives', 'GET');
    const objectivesWrite = canAccess('/objectives', 'POST');
    if (objectivesRead) permissions.add(Permission.OBJECTIVES_READ);
    if (objectivesWrite) permissions.add(Permission.OBJECTIVES_WRITE);

    // Analyze release permissions
    const releasesRead = canAccess('/releases', 'GET');
    const releasesWrite = canAccess('/releases', 'POST');
    if (releasesRead) permissions.add(Permission.RELEASES_READ);
    if (releasesWrite) permissions.add(Permission.RELEASES_WRITE);

    // Analyze custom field permissions
    const customFieldsRead = canAccess('/custom_fields', 'GET');
    const customFieldsWrite = canAccess('/custom_fields', 'POST');
    if (customFieldsRead) permissions.add(Permission.CUSTOM_FIELDS_READ);
    if (customFieldsWrite) permissions.add(Permission.CUSTOM_FIELDS_WRITE);

    // Analyze webhook permissions
    const webhooksRead = canAccess('/webhooks', 'GET');
    const webhooksWrite = canAccess('/webhooks', 'POST');
    if (webhooksRead) permissions.add(Permission.WEBHOOKS_READ);
    if (webhooksWrite) permissions.add(Permission.WEBHOOKS_WRITE);

    // Analyze search permissions
    const searchEnabled = canAccess('/search', 'GET');
    if (searchEnabled) permissions.add(Permission.SEARCH);

    // Analyze analytics permissions
    const analyticsRead = canAccess('/analytics', 'GET');
    if (analyticsRead) permissions.add(Permission.ANALYTICS_READ);

    // Determine access level
    const canWrite = featuresWrite || productsWrite || notesWrite || objectivesWrite || releasesWrite;
    const canDelete = false; // We didn't test delete operations to avoid data loss
    const isAdmin = analyticsRead || (usersRead && usersWrite); // Admin indicators

    let accessLevel: AccessLevel;
    if (isAdmin) {
      accessLevel = AccessLevel.ADMIN;
    } else if (canDelete) {
      accessLevel = AccessLevel.DELETE;
    } else if (canWrite) {
      accessLevel = AccessLevel.WRITE;
    } else {
      accessLevel = AccessLevel.READ;
    }

    // Build comprehensive capabilities object
    const capabilities = {
      users: {
        read: usersRead,
        write: usersWrite,
        admin: isAdmin,
      },
      features: {
        read: featuresRead,
        write: featuresWrite,
        delete: canDelete,
      },
      products: {
        read: productsRead,
        write: productsWrite,
        delete: canDelete,
      },
      notes: {
        read: notesRead,
        write: notesWrite,
        delete: canDelete,
      },
      companies: {
        read: companiesRead,
        write: false, // Usually read-only
      },
      objectives: {
        read: objectivesRead,
        write: objectivesWrite,
        delete: canDelete,
      },
      releases: {
        read: releasesRead,
        write: releasesWrite,
        delete: canDelete,
      },
      customFields: {
        read: customFieldsRead,
        write: customFieldsWrite,
        delete: canDelete,
      },
      webhooks: {
        read: webhooksRead,
        write: webhooksWrite,
        delete: canDelete,
      },
      analytics: {
        read: analyticsRead,
      },
      integrations: {
        read: true, // Usually available if other permissions exist
        write: canWrite,
      },
      export: {
        data: featuresRead, // Can export if can read features
      },
      bulk: {
        operations: canWrite, // Bulk operations require write access
      },
      search: {
        enabled: searchEnabled,
      },
    };

    return {
      accessLevel,
      isReadOnly: !canWrite,
      canWrite,
      canDelete,
      isAdmin,
      permissions,
      capabilities,
    };
  }
}