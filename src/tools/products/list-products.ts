import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';
interface ListProductsParams {
  parent_id?: string;
  include_components?: boolean;
  include_archived?: boolean;
}

export class ListProductsTool extends BaseTool<ListProductsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_product_list',
      'List all products in the workspace',
      {
        type: 'object',
        properties: {
          parent_id: {
            type: 'string',
            description: 'Filter by parent product ID (for sub-products)',
          },
          include_components: {
            type: 'boolean',
            default: false,
            description: 'Include component information',
          },
          include_archived: {
            type: 'boolean',
            default: false,
            description: 'Include archived products',
          },
        },
      },
      {
        requiredPermissions: [Permission.PRODUCTS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to products',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListProductsParams): Promise<unknown> {
    try {
      this.logger.info('Listing products');

      const queryParams: Record<string, any> = {};
      if (params.parent_id) queryParams.parent_id = params.parent_id;
      if (params.include_components) queryParams.include_components = params.include_components;
      if (params.include_archived) queryParams.include_archived = params.include_archived;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/products',
        params: queryParams,
      });

      return {
        success: true,
        data: {
          products: Array.isArray((response as any).data) ? (response as any).data : [],
          total: Array.isArray((response as any).data) ? (response as any).data.length : 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list products', error);

      return {
        success: false,
        error: `Failed to list products: ${(error as Error).message}`,
      };
    }
  }
}