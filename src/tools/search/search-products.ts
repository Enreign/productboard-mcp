import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SearchProductsParams {
  query: string;
  includeComponents?: boolean;
  limit?: number;
  offset?: number;
}

export class SearchProductsTool extends BaseTool<SearchProductsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_search_products',
      'Search for products and components',
      {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          includeComponents: {
            type: 'boolean',
            default: true,
            description: 'Include components in search results',
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

  protected async executeInternal(params: SearchProductsParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Searching products', { query: params.query });

      const queryParams: Record<string, any> = {
        q: params.query,
        include_components: params.includeComponents !== false,
        limit: params.limit || 20,
        offset: params.offset || 0,
      };

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/search/products',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to search products', error);
      
      return {
        success: false,
        error: `Failed to search products: ${(error as Error).message}`,
      };
    }
  }
}