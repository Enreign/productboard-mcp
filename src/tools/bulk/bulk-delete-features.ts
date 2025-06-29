import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface BulkDeleteFeaturesParams {
  feature_ids: string[];
  permanent?: boolean;
  batch_size?: number;
}

export class BulkDeleteFeaturesTool extends BaseTool<BulkDeleteFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_bulk_delete',
      'Bulk delete or archive multiple features',
      {
        type: 'object',
        required: ['feature_ids'],
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
            description: 'Feature IDs to delete',
          },
          permanent: {
            type: 'boolean',
            default: false,
            description: 'If true, permanently delete. If false, archive.',
          },
          batch_size: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Number of features to delete per batch',
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

  protected async executeInternal(params: BulkDeleteFeaturesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Bulk deleting features', { 
        count: params.feature_ids.length,
        permanent: params.permanent 
      });

      const batchSize = params.batch_size || 10;
      const results = {
        deleted: [] as string[],
        archived: [] as string[],
        failed: [] as { id: string; error: string }[],
      };

      for (let i = 0; i < params.feature_ids.length; i += batchSize) {
        const batch = params.feature_ids.slice(i, i + batchSize);
        
        if (params.permanent) {
          try {
            await this.apiClient.makeRequest({
              method: 'DELETE',
              endpoint: '/features/bulk',
              data: { feature_ids: batch },
            });
            results.deleted.push(...batch);
          } catch (error) {
            this.logger.error(`Failed to delete batch ${i / batchSize + 1}`, error);
            batch.forEach(id => {
              results.failed.push({
                id,
                error: (error as Error).message,
              });
            });
          }
        } else {
          try {
            await this.apiClient.patch('/features/bulk', {
              feature_ids: batch,
              updates: { status: 'archived' },
            });
            results.archived.push(...batch);
          } catch (error) {
            this.logger.error(`Failed to archive batch ${i / batchSize + 1}`, error);
            batch.forEach(id => {
              results.failed.push({
                id,
                error: (error as Error).message,
              });
            });
          }
        }
      }

      return {
        success: results.failed.length === 0,
        data: {
          ...results,
          total_processed: params.feature_ids.length,
          total_succeeded: results.deleted.length + results.archived.length,
          total_failed: results.failed.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to bulk delete features', error);
      
      return {
        success: false,
        error: `Failed to bulk delete features: ${(error as Error).message}`,
      };
    }
  }
}