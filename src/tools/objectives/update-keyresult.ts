import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UpdateKeyResultParams {
  id: string;
  name?: string;
  metric_type?: 'number' | 'percentage' | 'currency';
  current_value?: number;
  target_value?: number;
  unit?: string;
}

export class UpdateKeyResultTool extends BaseTool<UpdateKeyResultParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_keyresult_update',
      'Update an existing key result',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Key result ID to update',
          },
          name: {
            type: 'string',
            description: 'Key result name',
          },
          metric_type: {
            type: 'string',
            enum: ['number', 'percentage', 'currency'],
            description: 'Type of metric',
          },
          current_value: {
            type: 'number',
            description: 'Current metric value',
          },
          target_value: {
            type: 'number',
            description: 'Target metric value',
          },
          unit: {
            type: 'string',
            description: 'Measurement unit (e.g., "users", "dollars")',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: UpdateKeyResultParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Updating key result', { id: params.id });

      const { id, ...updateData } = params;
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No update fields provided',
        };
      }

      const response = await this.apiClient.put(`/keyresults/${id}`, updateData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to update key result', error);
      
      return {
        success: false,
        error: `Failed to update key result: ${(error as Error).message}`,
      };
    }
  }
}