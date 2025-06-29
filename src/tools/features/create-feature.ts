import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateFeatureParams {
  name: string;
  description: string;
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export class CreateFeatureTool extends BaseTool<CreateFeatureParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_create',
      'Create a new feature in Productboard',
      {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            description: 'Feature name (max 255 characters)',
            maxLength: 255,
          },
          description: {
            type: 'string',
            description: 'Detailed feature description',
          },
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
            default: 'new',
            description: 'Feature status',
          },
          product_id: {
            type: 'string',
            description: 'ID of the parent product',
          },
          component_id: {
            type: 'string',
            description: 'ID of the component this feature belongs to',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Email of the feature owner',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to categorize the feature',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Feature priority level',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to create features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: CreateFeatureParams): Promise<ToolExecutionResult> {
    try {
      // Set default status if not provided
      const requestData = {
        ...params,
        status: params.status || 'new',
      };

      const response = await this.apiClient.post('/features', requestData);

      return {
        success: true,
        data: (response as any).data || response,
      };
    } catch (error) {
      this.logger.error('Failed to create feature', error);
      
      return {
        success: false,
        error: `Failed to create feature: ${(error as Error).message}`,
      };
    }
  }
}