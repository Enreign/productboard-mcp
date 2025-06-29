import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ReleaseTimelineParams {
  release_group_id?: string;
  date_from?: string;
  date_to?: string;
  include_features?: boolean;
}

export class ReleaseTimelineTool extends BaseTool<ReleaseTimelineParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_timeline',
      'Get release timeline with features and milestones',
      {
        type: 'object',
        properties: {
          release_group_id: {
            type: 'string',
            description: 'Filter by release group',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for timeline',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for timeline',
          },
          include_features: {
            type: 'boolean',
            default: true,
            description: 'Include features in timeline',
          },
        },
      },
      {
        requiredPermissions: [Permission.RELEASES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to releases',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ReleaseTimelineParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Getting release timeline');

      const queryParams: Record<string, any> = {};
      if (params.release_group_id) queryParams.release_group_id = params.release_group_id;
      if (params.date_from) queryParams.date_from = params.date_from;
      if (params.date_to) queryParams.date_to = params.date_to;
      if (params.include_features !== undefined) queryParams.include_features = params.include_features;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/releases/timeline',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to get release timeline', error);
      
      return {
        success: false,
        error: `Failed to get release timeline: ${(error as Error).message}`,
      };
    }
  }
}