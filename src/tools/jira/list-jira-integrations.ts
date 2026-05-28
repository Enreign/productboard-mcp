import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListJiraIntegrationsParams {
  // No parameters — this lists all integrations available to the token
}

export class ListJiraIntegrationsTool extends BaseTool<ListJiraIntegrationsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_jira_integration_list',
      'List all Jira integrations configured in the Productboard workspace. Returns integration IDs needed for managing connections between Productboard features and Jira issues.',
      {
        type: 'object',
        properties: {},
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features (integrations are scoped to feature data)',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(_params: ListJiraIntegrationsParams): Promise<unknown> {
    this.logger.info('Listing Jira integrations');

    const response = await this.apiClient.get('/jira-integrations');

    return {
      success: true,
      data: (response as any).data || response,
    };
  }
}
