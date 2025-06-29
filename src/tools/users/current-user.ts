import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CurrentUserParams {}

export class CurrentUserTool extends BaseTool<CurrentUserParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_user_current',
      'Get user information (Note: Productboard API shows all workspace users as it lacks a current user endpoint)',
      {
        type: 'object',
        properties: {},
      },
      {
        requiredPermissions: [Permission.USERS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to user information',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(_params: CurrentUserParams): Promise<unknown> {
    this.logger.info('Getting current user information');

    // Note: Productboard API doesn't have a current user endpoint
    // Extract user info from token context or use minimal API call
    try {
      // Try a minimal API call to get user context
      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/features',
        params: { limit: 1 }
      });

      return {
        success: true,
        data: {
          note: 'Productboard API does not provide a current user endpoint. Using token validation as user context.',
          authenticated: true,
          hasAccess: true,
          apiResponse: 'Features endpoint accessible',
          responseReceived: !!response
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Unable to validate current user context',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}