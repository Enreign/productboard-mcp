import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface LinkFeaturesToObjectiveParams {
  objective_id: string;
  feature_ids: string[];
}

export class LinkFeaturesToObjectiveTool extends BaseTool<LinkFeaturesToObjectiveParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_link_feature',
      'Link features to an objective',
      {
        type: 'object',
        required: ['objective_id', 'feature_ids'],
        properties: {
          objective_id: {
            type: 'string',
            description: 'Objective ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to link',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: LinkFeaturesToObjectiveParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Linking features to objective', { 
        objective_id: params.objective_id,
        feature_count: params.feature_ids.length 
      });

      const response = await this.apiClient.post(`/objectives/${params.objective_id}/features`, {
        feature_ids: params.feature_ids,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to link features to objective', error);
      
      return {
        success: false,
        error: `Failed to link features to objective: ${(error as Error).message}`,
      };
    }
  }
}