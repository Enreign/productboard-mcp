import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

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

  protected async executeInternal(params: SearchNotesParams): Promise<unknown> {
    this.logger.info('Searching notes', { query: params.query });

    // Only pass filters supported by the /notes API endpoint
    const queryParams: Record<string, any> = {};

    if (params.filters) {
      if (params.filters.customer_emails?.length) queryParams.customer_email = params.filters.customer_emails[0];
      if (params.filters.company_names?.length) queryParams.company_name = params.filters.company_names[0];
      if (params.filters.tags?.length) queryParams.tags = params.filters.tags;
      if (params.filters.feature_ids?.length) queryParams.feature_id = params.filters.feature_ids[0];
      if (params.filters.created_after) queryParams.date_from = params.filters.created_after;
      if (params.filters.created_before) queryParams.date_to = params.filters.created_before;
    }

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/notes',
      params: queryParams,
    });

    // Filter client-side by query text
    let notes: any[] = Array.isArray((response as any)?.data) ? (response as any).data : [];
    if (params.query && params.query !== '*') {
      const query = params.query.toLowerCase();
      notes = notes.filter((n: any) =>
        n.title?.toLowerCase().includes(query) ||
        n.content?.toLowerCase().includes(query)
      );
    }

    // Apply client-side pagination
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const paginated = notes.slice(offset, offset + limit);

    const formatted = paginated.map((n: any, i: number) =>
      `${offset + i + 1}. ${n.title || n.content?.substring(0, 50) || 'Untitled Note'}\n` +
      `   Customer: ${n.customer?.email || 'Unknown'}\n` +
      `   Company: ${n.company?.name || 'Unknown'}\n` +
      `   Content: ${(n.content || '').substring(0, 100)}${(n.content || '').length > 100 ? '...' : ''}`
    );

    const summary = paginated.length > 0
      ? `Found ${notes.length} notes matching "${params.query}", showing ${paginated.length}:\n\n` + formatted.join('\n\n')
      : `No notes found matching "${params.query}".`;

    return { content: [{ type: 'text', text: summary }] };
  }
}