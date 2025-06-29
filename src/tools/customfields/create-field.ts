import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateCustomFieldParams {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  description?: string;
  required?: boolean;
  options?: string[];
  entity_type: 'feature' | 'note' | 'objective';
}

export class CreateCustomFieldTool extends BaseTool<CreateCustomFieldParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_customfield_create',
      'Create a new custom field',
      {
        type: 'object',
        required: ['name', 'type', 'entity_type'],
        properties: {
          name: {
            type: 'string',
            description: 'Custom field name',
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'select', 'multiselect', 'boolean'],
            description: 'Field data type',
          },
          description: {
            type: 'string',
            description: 'Field description',
          },
          required: {
            type: 'boolean',
            default: false,
            description: 'Whether the field is required',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Options for select/multiselect fields',
          },
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Entity type this field applies to',
          },
        },
      },
      {
        requiredPermissions: [Permission.CUSTOM_FIELDS_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to custom fields',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: CreateCustomFieldParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Creating custom field', { name: params.name, type: params.type });

      // Validate options for select fields
      if ((params.type === 'select' || params.type === 'multiselect') && !params.options?.length) {
        return {
          success: false,
          error: 'Options are required for select and multiselect field types',
        };
      }

      const response = await this.apiClient.post('/customfields', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create custom field', error);
      
      return {
        success: false,
        error: `Failed to create custom field: ${(error as Error).message}`,
      };
    }
  }
}