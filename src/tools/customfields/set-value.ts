import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface SetCustomFieldValueParams {
  entity_id: string;
  entity_type: 'feature' | 'note' | 'objective';
  field_id: string;
  value: any;
}

export class SetCustomFieldValueTool extends BaseTool<SetCustomFieldValueParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_customfield_value_set',
      'Set custom field value for an entity',
      {
        type: 'object',
        required: ['entity_id', 'entity_type', 'field_id', 'value'],
        properties: {
          entity_id: {
            type: 'string',
            description: 'ID of the entity (feature, note, objective)',
          },
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Type of entity',
          },
          field_id: {
            type: 'string',
            description: 'Custom field ID',
          },
          value: {
            description: 'Value to set (type depends on field type)',
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

  protected async executeInternal(params: SetCustomFieldValueParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Setting custom field value', { 
        entity_id: params.entity_id,
        field_id: params.field_id 
      });

      const response = await this.apiClient.put(
        `/customfields/${params.field_id}/values`,
        {
          entity_id: params.entity_id,
          entity_type: params.entity_type,
          value: params.value,
        }
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to set custom field value', error);
      
      return {
        success: false,
        error: `Failed to set custom field value: ${(error as Error).message}`,
      };
    }
  }
}