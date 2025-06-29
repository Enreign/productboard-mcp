import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface FeatureMetricsParams {
  feature_ids?: string[];
  product_id?: string;
  date_from?: string;
  date_to?: string;
  metrics?: ('views' | 'votes' | 'comments' | 'status_changes')[];
}

export class FeatureMetricsTool extends BaseTool<FeatureMetricsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_analytics_feature_metrics',
      'Get analytics metrics for features',
      {
        type: 'object',
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific feature IDs to analyze',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
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
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['views', 'votes', 'comments', 'status_changes'],
            },
            description: 'Types of metrics to retrieve',
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

  protected async executeInternal(params: FeatureMetricsParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Getting feature analytics metrics');

      const queryParams: Record<string, any> = {};
      if (params.feature_ids?.length) queryParams.feature_ids = params.feature_ids.join(',');
      if (params.product_id) queryParams.product_id = params.product_id;
      if (params.date_from) queryParams.date_from = params.date_from;
      if (params.date_to) queryParams.date_to = params.date_to;
      if (params.metrics?.length) queryParams.metrics = params.metrics.join(',');

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/analytics/features',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to get feature metrics', error);
      
      return {
        success: false,
        error: `Failed to get feature metrics: ${(error as Error).message}`,
      };
    }
  }
}