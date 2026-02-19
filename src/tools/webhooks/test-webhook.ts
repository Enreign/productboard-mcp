import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface TestWebhookParams {
  id: string;
  test_event?: string;
}

export class TestWebhookTool extends BaseTool<TestWebhookParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_webhook_test',
      'Test webhook endpoint with sample payload',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to test',
          },
          test_event: {
            type: 'string',
            default: 'test',
            description: 'Type of test event to send',
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

  protected async executeInternal(params: TestWebhookParams): Promise<unknown> {
    this.logger.info('Testing webhook', { id: params.id });

    const response = await this.apiClient.post(`/webhooks/${params.id}/test`, {
      event_type: params.test_event || 'test',
    });

    return {
      success: true,
      data: response,
    };
  }
}