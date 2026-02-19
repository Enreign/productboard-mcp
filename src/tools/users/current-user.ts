import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CurrentUserParams {}

export class CurrentUserTool extends BaseTool<CurrentUserParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_user_current',
      'Verify API access by testing a minimal API call',
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
    this.logger.info('Verifying API authentication status');

    await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/features',
      params: { limit: 1 }
    });

    return {
      content: [{ type: 'text', text: 'Authentication verified. API access confirmed.' }],
    };
  }
}
