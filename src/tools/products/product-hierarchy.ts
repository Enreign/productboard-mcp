import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
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

    const queryParams: Record<string, any> = { 'type[]': 'product' };
    if (params.product_id) queryParams.parent_id = params.product_id;

    const response = await this.apiClient.get('/entities', queryParams);

    const products: any[] = Array.isArray((response as any)?.data) ? (response as any).data : [];

    const formatTree = (items: any[], indent = 0): string =>
      items.map(p =>
        `${'  '.repeat(indent)}• ${p.fields?.name || 'Untitled'} (ID: ${p.id})\n` +
        (p.children?.length ? formatTree(p.children, indent + 1) : '')
      ).join('');

    const summary = products.length > 0
      ? `Product hierarchy (${products.length} products):\n\n` + formatTree(products)
      : 'No products found.';

    return { content: [{ type: 'text', text: summary }] };
  }
}