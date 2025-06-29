import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface DeleteFeatureParams {
  id: string;
  permanent?: boolean;
}

export class DeleteFeatureTool extends BaseTool<DeleteFeatureParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_delete',
      'Delete a feature (or archive it)',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature ID to delete',
          },
          permanent: {
            type: 'boolean',
            default: false,
            description: 'If true, permanently delete. If false, archive.',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_DELETE],
        minimumAccessLevel: AccessLevel.DELETE,
        description: 'Requires delete access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: DeleteFeatureParams): Promise<ToolExecutionResult> {
    try {
      const { id, permanent = false } = params;

      if (permanent) {
        // Permanent deletion
        await this.apiClient.delete(`/features/${id}`);
        return {
          success: true,
          data: {
            action: 'deleted',
            feature_id: id,
          },
        };
      } else {
        // Archive by updating status
        const feature = await this.apiClient.patch(`/features/${id}`, {
          status: 'archived',
        });
        return {
          success: true,
          data: {
            feature,
            action: 'archived',
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to delete feature', error);
      return {
        success: false,
        error: `Failed to delete feature: ${(error as Error).message}`,
      };
    }
  }
}