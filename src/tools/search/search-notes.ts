import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchNotesParams {
  query: string;
  filters?: {
    customer_emails?: string[];
    company_names?: string[];
    tags?: string[];
    source?: string[];
    created_after?: string;
    created_before?: string;
    feature_ids?: string[];
  };
  sort?: 'relevance' | 'created_at' | 'sentiment';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class SearchNotesTool extends BaseTool<SearchNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_notes',
      'Advanced search for customer notes',
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
              customer_emails: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by customer emails',
              },
              company_names: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by company names',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              source: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by source',
              },
              created_after: {
                type: 'string',
                format: 'date',
                description: 'Filter notes created after date',
              },
              created_before: {
                type: 'string',
                format: 'date',
                description: 'Filter notes created before date',
              },
              feature_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by attached feature IDs',
              },
            },
          },
          sort: {
            type: 'string',
            enum: ['relevance', 'created_at', 'sentiment'],
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

  protected async executeInternal(params: SearchNotesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching notes', { query: params.query });

      const queryParams: Record<string, any> = {
        q: params.query,
        sort: params.sort || 'relevance',
        order: params.order || 'desc',
        limit: params.limit || 20,
        offset: params.offset || 0,
      };

      if (params.filters) {
        if (params.filters.customer_emails?.length) queryParams.customer_emails = params.filters.customer_emails.join(',');
        if (params.filters.company_names?.length) queryParams.company_names = params.filters.company_names.join(',');
        if (params.filters.tags?.length) queryParams.tags = params.filters.tags.join(',');
        if (params.filters.source?.length) queryParams.source = params.filters.source.join(',');
        if (params.filters.created_after) queryParams.created_after = params.filters.created_after;
        if (params.filters.created_before) queryParams.created_before = params.filters.created_before;
        if (params.filters.feature_ids?.length) queryParams.feature_ids = params.filters.feature_ids.join(',');
      }

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/search/notes',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to search notes', error);
      
      return {
        success: false,
        error: `Failed to search notes: ${(error as Error).message}`,
      };
    }
  }
}