import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListObjectivesParams {
  status?: 'active' | 'completed' | 'cancelled';
  owner_email?: string;
  period?: 'quarter' | 'year';
  limit?: number;
  offset?: number;
}

export class ListObjectivesTool extends BaseTool<ListObjectivesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_list',
      'List objectives with optional filtering',
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Filter by objective status',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Filter by owner email',
          },
          period: {
            type: 'string',
            enum: ['quarter', 'year'],
            description: 'Filter by objective period',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of objectives to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of objectives to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListObjectivesParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Listing objectives');

      const queryParams: Record<string, any> = {};
      if (params.status) queryParams.status = params.status;
      if (params.owner_email) queryParams.owner_email = params.owner_email;
      if (params.period) queryParams.period = params.period;
      if (params.limit) queryParams.limit = params.limit;
      if (params.offset) queryParams.offset = params.offset;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/objectives',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to list objectives', error);
      
      return {
        success: false,
        error: `Failed to list objectives: ${(error as Error).message}`,
      };
    }
  }
}