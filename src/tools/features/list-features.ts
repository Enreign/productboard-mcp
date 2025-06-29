import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListFeaturesParams {
  status?: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  product_id?: string;
  component_id?: string;
  owner_email?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'created_at' | 'updated_at' | 'name' | 'priority';
  order?: 'asc' | 'desc';
}

export class ListFeaturesTool extends BaseTool<ListFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_list',
      'List features with optional filtering and pagination',
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
            description: 'Filter by feature status',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          component_id: {
            type: 'string',
            description: 'Filter by component ID',
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (features must have all specified tags)',
          },
          search: {
            type: 'string',
            description: 'Search in feature names and descriptions',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Number of results per page',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of results to skip',
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'name', 'priority'],
            default: 'created_at',
            description: 'Sort field',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
            description: 'Sort order',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListFeaturesParams): Promise<unknown> {
    // Build query parameters with only supported API parameters
    const queryParams: Record<string, any> = {};

    // Add supported parameters only
    if (params.status) queryParams.status = params.status;
    if (params.product_id) queryParams.product_id = params.product_id;
    if (params.component_id) queryParams.component_id = params.component_id;
    if (params.owner_email) queryParams.owner_email = params.owner_email;
    if (params.search) queryParams.search = params.search;
    if (params.tags && params.tags.length > 0) {
      queryParams.tags = params.tags.join(',');
    }

    // Note: Productboard API /features endpoint does not support limit, offset, sort, order parameters
    const response = await this.apiClient.get('/features', queryParams);
    
    // Extract feature data
    let features: any[] = [];
    if (response && (response as any).data) {
      features = (response as any).data;
    } else if (Array.isArray(response)) {
      features = response;
    }
    
    // Apply client-side pagination if requested
    const requestedLimit = params.limit || 20;
    const requestedOffset = params.offset || 0;
    const paginatedFeatures = features.slice(requestedOffset, requestedOffset + requestedLimit);
    
    // Helper function to strip HTML tags
    const stripHtml = (html: string): string => {
      return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&lt;/g, '<')   // Replace HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
    };
    
    // Format response for MCP protocol
    const formattedFeatures = paginatedFeatures.map((feature: any) => ({
      id: feature.id,
      name: feature.name || 'Untitled Feature',
      description: feature.description ? stripHtml(feature.description) : '',
      status: feature.status?.name || 'Unknown',
      owner: feature.owner?.email || 'Unassigned',
      createdAt: feature.createdAt,
      updatedAt: feature.updatedAt,
    }));
    
    // Create a text summary of the features
    const summary = formattedFeatures.length > 0
      ? `Found ${features.length} features total, showing ${formattedFeatures.length} features:\n\n` +
        formattedFeatures.map((f, i) => 
          `${i + 1}. ${f.name}\n` +
          `   Status: ${f.status}\n` +
          `   Owner: ${f.owner}\n` +
          `   Description: ${f.description || 'No description'}\n`
        ).join('\n')
      : 'No features found.';
    
    // Return in MCP expected format
    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ]
    };
  }
}