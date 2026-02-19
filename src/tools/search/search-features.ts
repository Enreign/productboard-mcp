import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

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

  protected async executeInternal(params: SearchFeaturesParams): Promise<unknown> {
    this.logger.info('Searching features', { query: params.query });

    // Only pass filters supported by /features endpoint (not limit/offset/sort/order)
    const queryParams: Record<string, any> = {};

    if (params.filters) {
      if (params.filters.status?.length) queryParams.status = params.filters.status[0]; // API takes single value
      if (params.filters.product_ids?.length) queryParams.product_id = params.filters.product_ids[0];
      if (params.filters.owner_emails?.length) queryParams.owner_email = params.filters.owner_emails[0];
      if (params.filters.tags?.length) queryParams.tags = params.filters.tags.join(',');
    }

    const response = await this.apiClient.makeRequest<any>({
      method: 'GET',
      endpoint: '/features',
      params: queryParams,
    });

    // Filter client-side by query text
    let features: any[] = Array.isArray(response?.data) ? response.data : [];
    if (params.query && params.query !== '*') {
      const query = params.query.toLowerCase();
      features = features.filter((f: any) =>
        f.name?.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.tags?.some((tag: any) => tag.name?.toLowerCase().includes(query))
      );
    }

    // Apply client-side pagination
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const paginated = features.slice(offset, offset + limit);

    const stripHtml = (html: string): string =>
      html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

    const formatted = paginated.map((f: any, i: number) =>
      `${offset + i + 1}. ${f.name || 'Untitled'}\n` +
      `   Status: ${f.status?.name || 'Unknown'}\n` +
      `   Owner: ${f.owner?.email || 'Unassigned'}\n` +
      `   Description: ${f.description ? stripHtml(f.description).substring(0, 120) : 'No description'}`
    );

    const summary = paginated.length > 0
      ? `Found ${features.length} matching features, showing ${paginated.length}:\n\n` + formatted.join('\n\n')
      : `No features found matching "${params.query}".`;

    return { content: [{ type: 'text', text: summary }] };
  }
}