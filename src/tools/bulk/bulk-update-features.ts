import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ValidationError } from '../../utils/errors.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface BulkUpdateFeaturesParams {
  feature_ids: string[];
  updates: {
    status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
    owner_email?: string;
    tags?: string[];
  };
}

export class BulkUpdateFeaturesTool extends BaseTool<BulkUpdateFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_bulk_update',
      'Update multiple features at once',
      {
        type: 'object',
        required: ['feature_ids', 'updates'],
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
            description: 'Feature IDs to update',
          },
          updates: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
              },
              owner_email: {
                type: 'string',
                format: 'email',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            description: 'Fields to update',
          },
        },
      },
      {
        requiredPermissions: [Permission.BULK_OPERATIONS],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access for bulk operations',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: BulkUpdateFeaturesParams): Promise<unknown> {
    // Validate that at least one update field is provided
    if (Object.keys(params.updates).length === 0) {
      throw new ValidationError('At least one update field must be provided');
    }
    
    this.logger.info('Bulk updating features', { count: params.feature_ids.length });

    const response = await this.apiClient.makeRequest({
      method: 'PATCH',
      endpoint: '/features/bulk',
      data: {
        feature_ids: params.feature_ids,
        updates: params.updates,
      },
    });

    if ((response as any)?.failed > 0) {
      this.logger.warn('Some features failed to update', {
        failed: (response as any).failed,
        total: params.feature_ids.length,
      });
    }

    return {
      success: true,
      data: response,
    };
  }
}