import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListCustomFieldsParams {
  entity_type?: 'feature' | 'note' | 'objective';
  type?: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  required?: boolean;
}

export class ListCustomFieldsTool extends BaseTool<ListCustomFieldsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_customfield_list',
      'List custom fields with optional filtering',
      {
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Filter by entity type',
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'select', 'multiselect', 'boolean'],
            description: 'Filter by field type',
          },
          required: {
            type: 'boolean',
            description: 'Filter by required status',
          },
        },
      },
      {
        requiredPermissions: [Permission.CUSTOM_FIELDS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to custom fields',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListCustomFieldsParams = {}): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Listing custom fields');

      const queryParams: Record<string, any> = {};
      if (params.entity_type) queryParams.entity_type = params.entity_type;
      if (params.type) queryParams.type = params.type;
      if (params.required !== undefined) queryParams.required = params.required;

      const response = await this.apiClient.makeRequest({
        method: 'GET',
        endpoint: '/customfields',
        params: queryParams,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to list custom fields', error);
      
      return {
        success: false,
        error: `Failed to list custom fields: ${(error as Error).message}`,
      };
    }
  }
}