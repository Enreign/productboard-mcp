import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UserEngagementParams {
  user_id?: string;
  user_role?: string;
  date_from?: string;
  date_to?: string;
  engagement_types?: ('logins' | 'features_created' | 'votes' | 'comments' | 'notes_created')[];
}

export class UserEngagementTool extends BaseTool<UserEngagementParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_analytics_user_engagement',
      'Get user engagement analytics',
      {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'Specific user ID to analyze',
          },
          user_role: {
            type: 'string',
            description: 'Filter by user role',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for metrics',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for metrics',
          },
          engagement_types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['logins', 'features_created', 'votes', 'comments', 'notes_created'],
            },
            description: 'Types of engagement to track',
          },
        },
      },
      {
        requiredPermissions: [Permission.ANALYTICS_READ],
        minimumAccessLevel: AccessLevel.ADMIN,
        description: 'Requires admin access for analytics',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: UserEngagementParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Getting user engagement analytics');

      const queryParams: Record<string, any> = {};
      if (params.user_id) queryParams.user_id = params.user_id;
      if (params.user_role) queryParams.user_role = params.user_role;
      if (params.date_from) queryParams.date_from = params.date_from;
      if (params.date_to) queryParams.date_to = params.date_to;
      if (params.engagement_types?.length) queryParams.engagement_types = params.engagement_types.join(',');

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/analytics/user-engagement',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to get user engagement analytics', error);
      
      return {
        success: false,
        error: `Failed to get user engagement analytics: ${(error as Error).message}`,
      };
    }
  }
}