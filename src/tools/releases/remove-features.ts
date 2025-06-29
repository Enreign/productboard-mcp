import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface RemoveFeaturesFromReleaseParams {
  release_id: string;
  feature_ids: string[];
}

export class RemoveFeaturesFromReleaseTool extends BaseTool<RemoveFeaturesFromReleaseParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_feature_remove',
      'Remove features from a release',
      {
        type: 'object',
        required: ['release_id', 'feature_ids'],
        properties: {
          release_id: {
            type: 'string',
            description: 'Release ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to remove from the release',
          },
        },
      },
      {
        requiredPermissions: [Permission.RELEASES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to releases',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: RemoveFeaturesFromReleaseParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Removing features from release', { 
        release_id: params.release_id,
        feature_count: params.feature_ids.length 
      });

      const response = await this.apiClient.makeRequest({
        method: 'DELETE',
        endpoint: `/releases/${params.release_id}/features`,
        data: {
          feature_ids: params.feature_ids,
        },
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to remove features from release', error);
      
      return {
        success: false,
        error: `Failed to remove features from release: ${(error as Error).message}`,
      };
    }
  }
}