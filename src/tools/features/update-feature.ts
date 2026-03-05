import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface UpdateFeatureParams {
  id: string;
  name?: string;
  description?: string;
  status_id?: string;
  owner_email?: string;
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
          status_id: {
            type: 'string',
            description: 'Status ID (UUID from the status object on the feature, e.g. from pb_feature_get)',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'New owner email',
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
    const { id, ...updateData } = params;

    const { owner_email, status_id, ...rest } = updateData as Record<string, unknown>;
    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;
    if (owner_email) fields.owner = { email: owner_email };
    if (status_id) fields.status = { id: status_id };

    const response = await this.apiClient.patch(`/entities/${id}`, { data: { fields } });

    return {
      success: true,
      data: (response as any).data || response,
    };
  }
}