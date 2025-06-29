import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListReleasesParams {
  release_group_id?: string;
  status?: 'planned' | 'in_progress' | 'released';
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class ListReleasesTool extends BaseTool<ListReleasesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_list',
      'List releases with optional filtering',
      {
        type: 'object',
        properties: {
          release_group_id: {
            type: 'string',
            description: 'Filter by release group',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'Filter by release status',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Filter releases after this date',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Filter releases before this date',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of releases to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of releases to skip',
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

  protected async executeInternal(params: ListReleasesParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Listing releases');

      const queryParams: Record<string, any> = {};
      if (params.release_group_id) queryParams.release_group_id = params.release_group_id;
      if (params.status) queryParams.status = params.status;
      if (params.date_from) queryParams.date_from = params.date_from;
      if (params.date_to) queryParams.date_to = params.date_to;
      if (params.limit) queryParams.limit = params.limit;
      if (params.offset) queryParams.offset = params.offset;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/releases',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to list releases', error);
      
      return {
        success: false,
        error: `Failed to list releases: ${(error as Error).message}`,
      };
    }
  }
}