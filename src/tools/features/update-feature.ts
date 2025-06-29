import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UpdateFeatureParams {
  id: string;
  name?: string;
  description?: string;
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  owner_email?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
}

export class UpdateFeatureTool extends BaseTool<UpdateFeatureParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_update',
      'Update an existing feature',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature ID to update',
          },
          name: {
            type: 'string',
            description: 'New feature name',
            maxLength: 255,
          },
          description: {
            type: 'string',
            description: 'New feature description',
          },
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
            description: 'New feature status',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'New owner email',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'New priority level',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Replace all tags',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to features',
      },
      apiClient,
      logger
    );
  }

  validateParams(params: unknown) {
    const baseValidation = super.validateParams(params);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    // Additional validation: ensure at least one field to update
    const { id, ...updateFields } = params as UpdateFeatureParams;
    if (Object.keys(updateFields).length === 0) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: 'At least one field must be provided for update',
          value: undefined,
        }],
      };
    }

    return { valid: true, errors: [] };
  }

  protected async executeInternal(params: UpdateFeatureParams): Promise<unknown> {
    try {
      const { id, ...updateData } = params;

      const response = await this.apiClient.patch(`/features/${id}`, updateData);

      return {
        success: true,
        data: (response as any).data || response,
      };
    } catch (error) {
      this.logger.error('Failed to update feature', error);

      return {
        success: false,
        error: `Failed to update feature: ${(error as Error).message}`,
      };
    }
  }
}