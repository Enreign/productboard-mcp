import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateWebhookParams {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

export class CreateWebhookTool extends BaseTool<CreateWebhookParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_webhook_create',
      'Create a new webhook subscription',
      {
        type: 'object',
        required: ['name', 'url', 'events'],
        properties: {
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
            minItems: 1,
            description: 'Event types to subscribe to',
          },
          secret: {
            type: 'string',
            description: 'Secret for webhook signature verification',
          },
          active: {
            type: 'boolean',
            default: true,
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

  protected async executeInternal(params: CreateWebhookParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Creating webhook', { name: params.name, url: params.url });

      const response = await this.apiClient.post('/webhooks', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create webhook', error);
      
      return {
        success: false,
        error: `Failed to create webhook: ${(error as Error).message}`,
      };
    }
  }
}