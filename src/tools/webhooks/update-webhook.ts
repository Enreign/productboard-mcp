import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UpdateWebhookParams {
  id: string;
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
}

export class UpdateWebhookTool extends BaseTool<UpdateWebhookParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_webhook_update',
      'Update webhook subscription settings',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to update',
          },
          name: {
            type: 'string',
            description: 'Webhook name',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Webhook endpoint URL',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Event types to subscribe to',
          },
          secret: {
            type: 'string',
            description: 'Secret for webhook signature verification',
          },
          active: {
            type: 'boolean',
            description: 'Whether webhook is active',
          },
        },
      },
      {
        requiredPermissions: [Permission.WEBHOOKS_WRITE],
        minimumAccessLevel: AccessLevel.ADMIN,
        description: 'Requires admin access for webhooks',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: UpdateWebhookParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Updating webhook', { id: params.id });

      const { id, ...updateData } = params;
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No update fields provided',
        };
      }

      const response = await this.apiClient.put(`/webhooks/${id}`, updateData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to update webhook', error);
      
      return {
        success: false,
        error: `Failed to update webhook: ${(error as Error).message}`,
      };
    }
  }
}