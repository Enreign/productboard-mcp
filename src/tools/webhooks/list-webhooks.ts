import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListWebhooksParams {
  active?: boolean;
  event_type?: string;
}

export class ListWebhooksTool extends BaseTool<ListWebhooksParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_webhook_list',
      'List webhook subscriptions',
      {
        type: 'object',
        properties: {
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          event_type: {
            type: 'string',
            description: 'Filter by event type',
          },
        },
      },
      {
        requiredPermissions: [Permission.WEBHOOKS_READ],
        minimumAccessLevel: AccessLevel.ADMIN,
        description: 'Requires admin access for webhooks',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListWebhooksParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Listing webhooks');

      const queryParams: Record<string, any> = {};
      if (params.active !== undefined) queryParams.active = params.active;
      if (params.event_type) queryParams.event_type = params.event_type;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/webhooks',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to list webhooks', error);
      
      return {
        success: false,
        error: `Failed to list webhooks: ${(error as Error).message}`,
      };
    }
  }
}