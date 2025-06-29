import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface GetFeatureParams {
  id: string;
  include?: Array<'notes' | 'objectives' | 'releases' | 'custom_fields'>;
}

export class GetFeatureTool extends BaseTool<GetFeatureParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_get',
      'Get detailed information about a specific feature',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature ID',
          },
          include: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['notes', 'objectives', 'releases', 'custom_fields'],
            },
            description: 'Additional data to include',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: GetFeatureParams): Promise<unknown> {
    this.logger.info('Getting feature details', { featureId: params.id });

    const queryParams: Record<string, any> = {};
    if (params.include && params.include.length > 0) {
      queryParams.include = params.include.join(',');
    }

    const response = await this.apiClient.get(`/features/${params.id}`, queryParams);

    return {
      success: true,
      data: (response as any).data || response,
    };
  }
}