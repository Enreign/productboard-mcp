import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
interface CreateProductParams {
  name: string;
  description?: string;
  parent_id?: string;
  owner_email?: string;
}

export class CreateProductTool extends BaseTool<CreateProductParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_product_create',
      'Create a new product or sub-product',
      {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Product name',
          },
          description: {
            type: 'string',
            description: 'Product description',
          },
          parent_id: {
            type: 'string',
            description: 'Parent product ID (for creating sub-products)',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Product owner email',
          },
        },
      },
      {
        requiredPermissions: [Permission.PRODUCTS_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to products',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: CreateProductParams): Promise<unknown> {
    this.logger.info('Creating product', { name: params.name });

    const { parent_id, owner_email, ...rest } = params;
    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;
    if (owner_email) fields.owner = { email: owner_email };

    const relationships: Array<{ type: string; target: { id: string } }> = [];
    if (parent_id) relationships.push({ type: 'parent', target: { id: parent_id } });

    const requestData: Record<string, unknown> = { type: 'product', fields };
    if (relationships.length > 0) requestData.relationships = relationships;

    const response = await this.apiClient.post('/entities', { data: requestData });

    return {
      success: true,
      data: response,
    };
  }
}