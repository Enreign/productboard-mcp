import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
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
    this.logger.info('Listing products');

    const queryParams: Record<string, any> = { type: 'product' };
    if (params.parent_id) queryParams.parent_id = params.parent_id;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/entities',
      params: queryParams,
    });

    const products: any[] = Array.isArray((response as any).data) ? (response as any).data : [];

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const formatted = products.map((p: any, i: number) =>
      `${i + 1}. ${p.name || 'Untitled Product'}\n` +
      `   ID: ${p.id}\n` +
      (p.description ? `   Description: ${stripHtml(p.description).substring(0, 120)}\n` : '')
    );

    const summary = products.length > 0
      ? `Found ${products.length} products:\n\n` + formatted.join('\n')
      : 'No products found.';

    return { content: [{ type: 'text', text: summary }] };
  }
}