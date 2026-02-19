import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface AddFeaturesToReleaseParams {
  release_id: string;
  feature_ids: string[];
}

export class AddFeaturesToReleaseTool extends BaseTool<AddFeaturesToReleaseParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_feature_add',
      'Add features to a release',
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
            description: 'Feature IDs to add to the release',
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

  protected async executeInternal(params: AddFeaturesToReleaseParams): Promise<unknown> {
    this.logger.info('Adding features to release', {
      release_id: params.release_id,
      feature_count: params.feature_ids.length
    });

    const response = await this.apiClient.post(`/releases/${params.release_id}/features`, {
      feature_ids: params.feature_ids,
    });

    return {
      success: true,
      data: response,
    };
  }
}