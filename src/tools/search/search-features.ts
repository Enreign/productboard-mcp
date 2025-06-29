import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchFeaturesParams {
  query: string;
  filters?: {
    status?: string[];
    product_ids?: string[];
    owner_emails?: string[];
    tags?: string[];
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    updated_before?: string;
  };
  sort?: 'relevance' | 'created_at' | 'updated_at' | 'votes' | 'comments';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class SearchFeaturesTool extends BaseTool<SearchFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_features',
      'Advanced search for features',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          filters: {
            type: 'object',
            properties: {
              status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by status',
              },
              product_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by product IDs',
              },
              owner_emails: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by owner emails',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              created_after: {
                type: 'string',
                format: 'date',
                description: 'Filter features created after date',
              },
              created_before: {
                type: 'string',
                format: 'date',
                description: 'Filter features created before date',
              },
              updated_after: {
                type: 'string',
                format: 'date',
                description: 'Filter features updated after date',
              },
              updated_before: {
                type: 'string',
                format: 'date',
                description: 'Filter features updated before date',
              },
            },
          },
          sort: {
            type: 'string',
            enum: ['relevance', 'created_at', 'updated_at', 'votes', 'comments'],
            default: 'relevance',
            description: 'Sort results by',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of results',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.SEARCH],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires search access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: SearchFeaturesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching features', { query: params.query });

      const queryParams: Record<string, any> = {
        q: params.query,
        sort: params.sort || 'relevance',
        order: params.order || 'desc',
        limit: params.limit || 20,
        offset: params.offset || 0,
      };

      if (params.filters) {
        if (params.filters.status?.length) queryParams.status = params.filters.status.join(',');
        if (params.filters.product_ids?.length) queryParams.product_ids = params.filters.product_ids.join(',');
        if (params.filters.owner_emails?.length) queryParams.owner_emails = params.filters.owner_emails.join(',');
        if (params.filters.tags?.length) queryParams.tags = params.filters.tags.join(',');
        if (params.filters.created_after) queryParams.created_after = params.filters.created_after;
        if (params.filters.created_before) queryParams.created_before = params.filters.created_before;
        if (params.filters.updated_after) queryParams.updated_after = params.filters.updated_after;
        if (params.filters.updated_before) queryParams.updated_before = params.filters.updated_before;
      }

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/search/features',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to search features', error);
      
      return {
        success: false,
        error: `Failed to search features: ${(error as Error).message}`,
      };
    }
  }
}