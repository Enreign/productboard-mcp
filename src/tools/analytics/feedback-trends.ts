import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface FeedbackTrendsParams {
  date_from?: string;
  date_to?: string;
  product_id?: string;
  feature_id?: string;
  source?: string;
  tags?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

export class FeedbackTrendsTool extends BaseTool<FeedbackTrendsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_analytics_feedback_trends',
      'Analyze feedback trends over time',
      {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for analysis',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for analysis',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          feature_id: {
            type: 'string',
            description: 'Filter by feature ID',
          },
          source: {
            type: 'string',
            description: 'Filter by feedback source',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          groupBy: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            default: 'week',
            description: 'Time period grouping',
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

  protected async executeInternal(params: FeedbackTrendsParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Analyzing feedback trends');

      const queryParams: Record<string, any> = {};
      if (params.date_from) queryParams.date_from = params.date_from;
      if (params.date_to) queryParams.date_to = params.date_to;
      if (params.product_id) queryParams.product_id = params.product_id;
      if (params.feature_id) queryParams.feature_id = params.feature_id;
      if (params.source) queryParams.source = params.source;
      if (params.tags?.length) queryParams.tags = params.tags.join(',');
      if (params.groupBy) queryParams.group_by = params.groupBy;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/analytics/feedback-trends',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to analyze feedback trends', error);
      
      return {
        success: false,
        error: `Failed to analyze feedback trends: ${(error as Error).message}`,
      };
    }
  }
}