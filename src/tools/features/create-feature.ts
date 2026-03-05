import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';
import { FeaturePayload } from './types.js';

export class CreateFeatureTool extends BaseTool<FeaturePayload> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_create',
      'Create a new feature in Productboard',
      {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            description: 'Feature name (max 255 characters)',
            maxLength: 255,
          },
          description: {
            type: 'string',
            description: 'Detailed feature description',
          },
          product_id: {
            type: 'string',
            description: 'ID of the parent product',
          },
          component_id: {
            type: 'string',
            description: 'ID of the component this feature belongs to',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Email of the feature owner',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to categorize the feature',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Feature priority level',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to create features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: FeaturePayload): Promise<unknown> {
    const { owner_email, product_id, component_id, ...rest } = params;

    const toHtml = (text: string) => text.startsWith('<') ? text : `<p>${text}</p>`;

    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = toHtml(fields.description as string);
    if (owner_email) fields.owner = { email: owner_email };

    const relationships: Array<{ type: string; target: { id: string } }> = [];
    if (component_id) relationships.push({ type: 'parent', target: { id: component_id } });
    else if (product_id) relationships.push({ type: 'parent', target: { id: product_id } });

    const requestData: Record<string, unknown> = { type: 'feature', fields };
    if (relationships.length > 0) requestData.relationships = relationships;

    const response = await this.apiClient.post('/entities', { data: requestData });

    return {
      success: true,
      data: (response as any).data || response,
    };
  }
}