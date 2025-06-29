import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface BulkFeature {
  name: string;
  description: string;
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

interface BulkCreateFeaturesParams {
  features: BulkFeature[];
  batch_size?: number;
}

export class BulkCreateFeaturesTool extends BaseTool<BulkCreateFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_bulk_create',
      'Bulk create multiple features',
      {
        type: 'object',
        required: ['features'],
        properties: {
          features: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'description'],
              properties: {
                name: {
                  type: 'string',
                  description: 'Feature name',
                },
                description: {
                  type: 'string',
                  description: 'Feature description',
                },
                status: {
                  type: 'string',
                  enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
                  description: 'Feature status',
                },
                product_id: {
                  type: 'string',
                  description: 'Product ID',
                },
                component_id: {
                  type: 'string',
                  description: 'Component ID',
                },
                owner_email: {
                  type: 'string',
                  format: 'email',
                  description: 'Owner email',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Feature tags',
                },
                priority: {
                  type: 'string',
                  enum: ['critical', 'high', 'medium', 'low'],
                  description: 'Feature priority',
                },
              },
            },
            minItems: 1,
            maxItems: 100,
            description: 'Features to create',
          },
          batch_size: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Number of features to create per batch',
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

  protected async executeInternal(params: BulkCreateFeaturesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Bulk creating features', { count: params.features.length });

      const batchSize = params.batch_size || 10;
      const results = [];
      const errors = [];

      for (let i = 0; i < params.features.length; i += batchSize) {
        const batch = params.features.slice(i, i + batchSize);
        
        try {
          const response = await this.apiClient.post('/features/bulk', {
            features: batch.map(f => ({
              ...f,
              status: f.status || 'new',
            })),
          });
          
          results.push(...(response as any).created);
        } catch (error) {
          this.logger.error(`Failed to create batch ${i / batchSize + 1}`, error);
          errors.push({
            batch: i / batchSize + 1,
            error: (error as Error).message,
          });
        }
      }

      return {
        success: errors.length === 0,
        data: {
          created: results,
          total_created: results.length,
          total_requested: params.features.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      this.logger.error('Failed to bulk create features', error);
      
      return {
        success: false,
        error: `Failed to bulk create features: ${(error as Error).message}`,
      };
    }
  }
}