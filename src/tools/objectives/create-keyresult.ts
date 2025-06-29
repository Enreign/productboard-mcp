import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateKeyResultParams {
  objective_id: string;
  name: string;
  metric_type?: 'number' | 'percentage' | 'currency';
  current_value?: number;
  target_value: number;
  unit?: string;
}

export class CreateKeyResultTool extends BaseTool<CreateKeyResultParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_keyresult_create',
      'Create a key result for an objective',
      {
        type: 'object',
        required: ['objective_id', 'name', 'target_value'],
        properties: {
          objective_id: {
            type: 'string',
            description: 'Parent objective ID',
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

  protected async executeInternal(params: CreateKeyResultParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Creating key result', { 
        name: params.name, 
        objective_id: params.objective_id 
      });

      const response = await this.apiClient.post('/keyresults', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create key result', error);
      
      return {
        success: false,
        error: `Failed to create key result: ${(error as Error).message}`,
      };
    }
  }
}