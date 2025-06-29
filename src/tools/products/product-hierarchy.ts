import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';
interface ProductHierarchyParams {
  product_id?: string;
  depth?: number;
  include_features?: boolean;
}

export class ProductHierarchyTool extends BaseTool<ProductHierarchyParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_product_hierarchy',
      'Get the complete product hierarchy tree',
      {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Root product ID (optional, defaults to all top-level products)',
          },
          depth: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            default: 3,
            description: 'Maximum depth of hierarchy to retrieve',
          },
          include_features: {
            type: 'boolean',
            default: false,
            description: 'Include features at each level',
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

  protected async executeInternal(params: ProductHierarchyParams): Promise<unknown> {
    this.logger.info('Getting product hierarchy');

    const queryParams: Record<string, any> = {
      depth: params.depth || 3,
    };
    
    if (params.product_id) queryParams.product_id = params.product_id;
    if (params.include_features) queryParams.include_features = params.include_features;

    const response = await this.apiClient.get('/products/hierarchy', queryParams);

    return {
      success: true,
      data: response,
    };
  }
}