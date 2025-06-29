import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface DeleteWebhookParams {
  id: string;
}

export class DeleteWebhookTool extends BaseTool<DeleteWebhookParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_webhook_delete',
      'Delete a webhook subscription',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to delete',
          },
        },
      },
      {
        requiredPermissions: [Permission.WEBHOOKS_DELETE],
        minimumAccessLevel: AccessLevel.ADMIN,
        description: 'Requires admin access for webhooks',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: DeleteWebhookParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Deleting webhook', { id: params.id });

      await this.apiClient.delete(`/webhooks/${params.id}`);

      return {
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: params.id,
        },
      };
    } catch (error) {
      this.logger.error('Failed to delete webhook', error);
      
      return {
        success: false,
        error: `Failed to delete webhook: ${(error as Error).message}`,
      };
    }
  }
}